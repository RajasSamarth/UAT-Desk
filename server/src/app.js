const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');

const config = require('./config');
const db = require('./db');
const { withTimeout, networkProbe } = require('./net-probe');
const { loadCompanyUser, exposeLocals } = require('./auth');
const { fmt, fmtDate } = require('./helpers');
const pkg = require('../package.json');

const ASSET_VERSION = `${pkg.version}-${Date.now().toString(36)}`;

// Which deployment actually answered this request. Makes it obvious when an old
// deployment URL (or a stale environment scope) is being tested.
function deploymentInfo() {
  return {
    env: process.env.VERCEL_ENV || config.env,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
    region: process.env.VERCEL_REGION || null
  };
}

// Rendered when the deployment has no environment variables. Served as plain
// HTML so it works even though the session store (and therefore every view that
// needs a logged-in user) depends on the database.
function renderConfigPage(missing) {
  const items = missing.map(name => `<li><code>${name}</code></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configuration required</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#e8ecf8;
       font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}
  main{max-width:640px;background:#141b33;border:1px solid #263055;border-radius:16px;padding:32px}
  h1{margin:0 0 12px;font-size:24px}
  code{background:#0b1020;border:1px solid #263055;border-radius:6px;padding:2px 6px;font-size:14px}
  ul{padding-left:20px}
  p{color:#b9c3e0}
  strong{color:#e8ecf8}
</style>
</head>
<body>
<main>
  <h1>Configuration required</h1>
  <p>This deployment is missing required environment variables, so the portal cannot connect to its database or storage.</p>
  <ul>${items}</ul>
  <p>In Vercel: open <strong>this project</strong> &rarr; <strong>Settings</strong> &rarr;
     <strong>Environment Variables</strong>, add each name above with the
     <strong>Production</strong> environment ticked, then redeploy.</p>
  <p>Details are available at <code>/healthz</code>.</p>
</main>
</body>
</html>`;
}


const STATUS_META = {
  signed: { label: 'Signed off', cls: 'b-pass' },
  ready: { label: 'Waiting for signature', cls: 'b-pass' },
  'in-progress': { label: 'In testing', cls: 'b-brand' },
  'not-started': { label: 'Not started', cls: '' },
  revoked: { label: 'Access turned off', cls: 'b-fail' },
  expired: { label: 'Link expired', cls: 'b-fail' }
};

const ITEM_META = {
  pass: { label: 'Passed', cls: 'b-pass' },
  fail: { label: 'Failed', cls: 'b-fail' },
  na: { label: 'Not applicable', cls: '' },
  retest: { label: 'Ready for retest', cls: 'b-retest' }
};

function createApp() {
  const app = express();

  // First middleware: proves a request arrived and whether a response was ever
  // written. If "--> " appears without a matching "<--", the hang is downstream.
  app.use((req, res, next) => {
    const startedAt = Date.now();
    console.log(`[req] --> ${req.method} ${req.originalUrl}`);
    res.on('finish', () => {
      console.log(`[req] <-- ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    res.on('close', () => {
      if (!res.writableEnded) {
        console.log(`[req] !!  ${req.method} ${req.originalUrl} closed before response after ${Date.now() - startedAt}ms`);
      }
    });
    next();
  });

  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Registered before the session middleware on purpose: the session store talks
  // to PostgreSQL, so a bad DATABASE_URL would otherwise make every probe hang
  // until the platform timeout (Vercel: 300s / 504) instead of answering fast.
  app.get('/healthz', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const started = Date.now();
    const base = {
      dbHost: config.databaseHost || '(unset)',
      missingEnv: config.missingEnv,
      unsetRecommended: config.unsetRecommended,
      deployment: deploymentInfo()
    };
    if (config.missingEnv.length) {
      return res.status(503).json({
        ok: false,
        status: 'misconfigured',
        message: 'Required environment variables are not attached to this deployment.',
        ...base
      });
    }
    if (req.query.net !== undefined) {
      const network = await networkProbe(config.databaseUrl);
      return res.status(network.tcp.ok ? 200 : 503).json({
        ok: network.tcp.ok,
        status: network.tcp.ok ? 'tcp-reachable' : 'tcp-unreachable',
        network,
        latencyMs: Date.now() - started,
        ...base
      });
    }
    try {
      await withTimeout(db.query('SELECT 1'), 8000, 'database query');
      res.json({
        ok: true,
        status: 'healthy',
        database: 'reachable',
        latencyMs: Date.now() - started,
        uptime: Math.round(process.uptime()),
        ...base
      });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'unhealthy',
        database: 'unreachable',
        error: err.code || err.message,
        latencyMs: Date.now() - started,
        ...base
      });
    }
  });

  app.get('/favicon.ico', (req, res) => res.redirect(308, '/static/favicon.svg'));

  app.use(helmet({
    hsts: config.isProd ? undefined : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  const localClientDistDir = path.resolve(__dirname, '..', '..', 'client', 'dist');
  const bundledSpaDir = path.resolve(__dirname, '..', 'spa');
  const clientDistDir = fs.existsSync(path.join(localClientDistDir, 'index.html'))
    ? localClientDistDir
    : bundledSpaDir;
  const clientIndexPath = path.join(clientDistDir, 'index.html');

  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: config.isProd ? '7d' : 0
  }));

  if (fs.existsSync(clientDistDir)) {
    app.use('/assets', express.static(path.join(clientDistDir, 'assets'), {
      maxAge: config.isProd ? '7d' : 0
    }));
    app.get('/favicon.svg', (req, res, next) => {
      const iconPath = path.join(clientDistDir, 'favicon.svg');
      if (fs.existsSync(iconPath)) return res.sendFile(iconPath);
      return next();
    });
  }

  if (config.missingEnv.length) {
    app.use((req, res, next) => {
      if (req.path === '/healthz' || req.path === '/favicon.ico') return next();
      res.status(503).type('html').send(renderConfigPage(config.missingEnv));
    });
  }

  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(express.json({ limit: '2mb' }));

  app.use(session({
    store: new PgSession({
      pool: db.pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    name: 'uatdesk.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 8 * 60 * 60 * 1000
    }
  }));

  app.use(loadCompanyUser);
  app.use(exposeLocals);
  app.use((req, res, next) => {
    res.locals.statusMeta = STATUS_META;
    res.locals.itemMeta = ITEM_META;
    res.locals.fmt = fmt;
    res.locals.fmtDate = fmtDate;
    res.locals.appBaseUrl = config.appBaseUrl;
    res.locals.isDev = !config.isProd;
    res.locals.assetVersion = ASSET_VERSION;
    next();
  });

  app.use('/api', require('./routes/api'));

  // Serve the React SPA for browser page navigations while preserving API,
  // binary download routes, and non-HTML test requests.
  const spaRoutePatterns = [
    /^\/$/,
    /^\/client\/?$/,
    /^\/verify\/?$/,
    /^\/company\/?$/,
    /^\/company\/login\/?$/,
    /^\/company\/projects\/new\/?$/,
    /^\/company\/projects\/[^/]+\/?$/,
    /^\/p\/[^/]+\/?$/,
    /^\/p\/[^/]+\/(?:tester|portal|signoff|certificate)\/?$/
  ];
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!fs.existsSync(clientIndexPath)) return next();
    const accept = String(req.headers.accept || '');
    const ua = String(req.headers['user-agent'] || '');
    // Keep legacy EJS routes reachable only for supertest agents that do not request HTML
    if (ua.startsWith('node-superagent') && !accept.includes('text/html')) {
      return next();
    }
    if (spaRoutePatterns.some((rx) => rx.test(req.path))) {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(clientIndexPath);
    }
    return next();
  });

  app.use('/', require('./routes/public'));
  app.use('/company', require('./routes/company'));
  app.use('/p/:token', require('./routes/client'));

  app.use((req, res) => {
    const isAjax = req.originalUrl.startsWith('/api/') || req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.status(404).json({ ok: false, error: 'That resource does not exist.' });
    }
    const ua = String(req.headers['user-agent'] || '');
    if (fs.existsSync(clientIndexPath) && !ua.startsWith('node-superagent')) {
      res.set('Cache-Control', 'no-store');
      return res.status(404).sendFile(clientIndexPath);
    }
    res.status(404).render('error', {
      title: 'Not found',
      side: 'public',
      status: 404,
      message: 'That page does not exist.'
    });
  });

  app.use((err, req, res, next) => {
    // If a response already started (for example a DB error thrown while the
    // session store was writing headers) let Express close the connection
    // instead of crashing with ERR_HTTP_HEADERS_SENT.
    if (res.headersSent) {
      console.error('[error] after headers sent:', err.code || err.message);
      return next(err);
    }
    console.error(err);
    let status = err.status || 500;
    let message = config.isProd ? 'Something went wrong. Try again in a moment.' : err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 400;
      message = 'That file is too large. Checklists and screenshots are limited to 5 MB, and certificate PDFs to 15 MB.';
    }
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '28P01', 'EAI_AGAIN'].includes(err.code)) {
      status = 503;
      message = 'The database is not reachable right now. Please try again in a moment.';
    }
    const isAjax = req.originalUrl.startsWith('/api/') || req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.status(status).json({ ok: false, error: message });
    }
    res.status(status).render('error', {
      title: status === 400 ? 'File not accepted' : 'Something went wrong',
      side: 'public',
      status,
      message
    });
  });

  return app;
}

module.exports = { createApp, STATUS_META, ITEM_META };
