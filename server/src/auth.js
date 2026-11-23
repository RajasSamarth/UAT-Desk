const db = require('./db');
const { randomString } = require('./security');
const { getProjectByToken } = require('./projectService');

function ensureCsrf(req) {
  if (!req.session.csrfToken) req.session.csrfToken = randomString(32);
  return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
  const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.status(403).json({
        ok: false,
        error: 'Session expired. Please reload the page.'
      });
    }
    return res.status(403).render('error', {
      title: 'Session expired',
      side: 'public',
      status: 403,
      message: 'This form has expired. Go back, reload the page and try again.'
    });
  }
  next();
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

async function loadCompanyUser(req, res, next) {
  try {
    if (req.session.companyUserId) {
      const { rows } = await db.query('SELECT id, email, name FROM company_users WHERE id = $1', [req.session.companyUserId]);
      if (rows.length) {
        req.companyUser = rows[0];
        res.locals.companyUser = rows[0];
      } else {
        delete req.session.companyUserId;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireCompany(req, res, next) {
  if (req.companyUser) return next();
  flash(req, 'error', 'Sign in to continue.');
  return res.redirect('/company/login');
}

async function loadClientProject(req, res, next) {
  try {
    const bundle = await getProjectByToken(req.params.token);
    if (!bundle) {
      return res.status(404).render('error', {
        title: 'Link not found',
        side: 'public',
        status: 404,
        message: 'This UAT link does not exist. Check the address in your invitation email.'
      });
    }
    req.bundle = bundle;
    res.locals.projectBundle = bundle;

    const session = req.session.client;
    req.clientAuthed = !!(session && session.projectId === bundle.project.id && session.token === bundle.link.token);
    if (req.clientAuthed && session.tester) {
      req.tester = session.tester;
      res.locals.tester = session.tester;
    }
    next();
  } catch (err) {
    next(err);
  }
}

function accessBlocked(bundle) {
  if (bundle.link.revoked_at) return 'revoked';
  if (bundle.expired) return 'expired';
  return null;
}

function requireClientAuth(req, res, next) {
  if (!req.clientAuthed) {
    flash(req, 'error', 'Enter the password from your invitation to continue.');
    return res.redirect(`/p/${req.bundle.link.token}`);
  }
  const blocked = accessBlocked(req.bundle);
  if (blocked) {
    return res.status(403).render('client/closed', {
      title: blocked === 'revoked' ? 'Access turned off' : 'Link expired',
      side: 'client',
      reason: blocked
    });
  }
  next();
}

function requireClientSession(req, res, next) {
  if (!req.clientAuthed) {
    flash(req, 'error', 'Enter the password from your invitation to continue.');
    return res.redirect(`/p/${req.bundle.link.token}`);
  }
  next();
}

function requireTester(req, res, next) {
  if (!req.tester) return res.redirect(`/p/${req.bundle.link.token}/tester`);
  next();
}

function exposeLocals(req, res, next) {
  res.locals.csrfToken = ensureCsrf(req);
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  const fullPath = (req.originalUrl ? req.originalUrl.split('?')[0] : (req.baseUrl ? `${req.baseUrl}${req.path}` : req.path)) || '/';
  res.locals.currentPath = fullPath;
  next();
}

module.exports = {
  ensureCsrf,
  requireCsrf,
  flash,
  loadCompanyUser,
  requireCompany,
  loadClientProject,
  requireClientAuth,
  requireClientSession,
  requireTester,
  accessBlocked,
  exposeLocals
};
