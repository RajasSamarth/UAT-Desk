const path = require('node:path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');

const config = require('./config');
const db = require('./db');
const { loadCompanyUser, exposeLocals } = require('./auth');
const { fmt, fmtDate } = require('./helpers');
const pkg = require('../package.json');

const ASSET_VERSION = `${pkg.version}-${Date.now().toString(36)}`;

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

  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet({
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

  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: config.isProd ? '7d' : 0
  }));

  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

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

  app.use('/', require('./routes/public'));
  app.use('/company', require('./routes/company'));
  app.use('/p/:token', require('./routes/client'));

  app.use((req, res) => {
    const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.status(404).json({ ok: false, error: 'That resource does not exist.' });
    }
    res.status(404).render('error', {
      title: 'Not found',
      side: 'public',
      status: 404,
      message: 'That page does not exist.'
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    let status = err.status || 500;
    let message = config.isProd ? 'Something went wrong. Try again in a moment.' : err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 400;
      message = 'That file is too large. Checklists and screenshots are limited to 5 MB, and certificate PDFs to 15 MB.';
    }
    const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
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
