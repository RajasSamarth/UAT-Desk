const express = require('express');
const multer = require('multer');

const db = require('../db');
const { verify: verifyLimiter, clientLogin: clientLoginLimiter } = require('../rateLimiters');
const { requireCsrf, accessBlocked } = require('../auth');
const { sha256Hex, scryptVerify } = require('../security');
const service = require('../projectService');
const { audit } = require('../audit');

const router = express.Router();
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 4);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 }
});

async function lookup(verificationId) {
  const clean = String(verificationId || '').trim().toUpperCase();
  if (!clean) return null;
  const { rows } = await db.query(
    `SELECT s.*, p.version, p.owner_name, pr.name AS product_name, c.name AS client_name, l.token
       FROM signoffs s
       JOIN projects p ON p.id = s.project_id
       JOIN products pr ON pr.id = p.product_id
       JOIN clients c ON c.id = p.client_id
       JOIN access_links l ON l.project_id = p.id
      WHERE upper(s.verification_id) = upper($1)`,
    [clean]
  );
  return rows[0] || null;
}

function renderVerify(res, { id, result, fileCheck = null, error = null, status = 200 }) {
  return res.status(status).render('public/verify', {
    title: 'Verify a certificate',
    side: 'public',
    id,
    result,
    fileCheck,
    error
  });
}

router.get('/', (req, res) => {
  res.render('public/index', {
    title: 'Acceptance testing and sign-off',
    side: 'public',
    companyUser: req.companyUser || null
  });
});

router.get('/client', (req, res) => {
  res.render('public/client-portal', {
    title: 'Client Acceptance Testing',
    side: 'client',
    token: String(req.query.token || '').trim().toUpperCase(),
    error: null
  });
});

router.post('/client', clientLoginLimiter, requireCsrf, async (req, res, next) => {
  try {
    let rawToken = String(req.body.token || '').trim();
    // Support pasting full URL like http://.../p/UAT-ACME23
    const match = /(?:^|\/p\/)([A-Za-z0-9-]+)\/?$/.exec(rawToken);
    const token = match ? match[1].toUpperCase() : rawToken.toUpperCase();
    const password = String(req.body.password || '');

    if (!token) {
      return res.status(400).render('public/client-portal', {
        title: 'Client Acceptance Testing',
        side: 'client',
        token: '',
        error: 'Enter the Project ID from your invitation email.'
      });
    }

    const bundle = await service.getProjectByToken(token);
    if (!bundle) {
      return res.status(404).render('public/client-portal', {
        title: 'Client Acceptance Testing',
        side: 'client',
        token,
        error: `Project ID “${token}” was not found. Please check your invitation email.`
      });
    }

    const blocked = accessBlocked(bundle);
    if (blocked) {
      return res.status(403).render('client/closed', {
        title: blocked === 'revoked' ? 'Access turned off' : 'Link expired',
        side: 'client',
        reason: blocked
      });
    }

    const { link } = bundle;
    if (link.failed_attempts >= 5 && link.locked_until && new Date(link.locked_until).getTime() > Date.now()) {
      const waitMinutes = Math.max(1, Math.ceil((new Date(link.locked_until).getTime() - Date.now()) / 60000));
      return res.status(403).render('public/client-portal', {
        title: 'Client Acceptance Testing',
        side: 'client',
        token,
        error: `Too many failed password attempts. Access is locked for ${waitMinutes} minute(s).`
      });
    }

    if (!password) {
      return res.redirect(`/p/${bundle.link.token}`);
    }

    const ok = scryptVerify(password, link.password_hash);
    if (!ok) {
      await service.recordAccessFailure(link.id);
      await audit({
        projectId: bundle.project.id,
        actor: 'Client (failed login)',
        action: 'access.failed',
        detail: `Failed password on project ${token}`,
        req
      });
      return res.status(401).render('public/client-portal', {
        title: 'Client Acceptance Testing',
        side: 'client',
        token,
        error: 'The password you entered does not match this project.'
      });
    }

    await service.clearAccessFailures(link.id);
    await audit({
      projectId: bundle.project.id,
      actor: 'Client',
      action: 'access.login',
      detail: `Password authenticated for project ${token}`,
      req
    });

    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.client = {
        projectId: bundle.project.id,
        token: bundle.link.token
      };
      if (bundle.signoff) {
        return res.redirect(`/p/${bundle.link.token}/certificate`);
      }
      return res.redirect(`/p/${bundle.link.token}/tester`);
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/verify', verifyLimiter, async (req, res, next) => {
  try {
    const id = req.query.id ? String(req.query.id) : '';
    let result = null;
    if (id) {
      const row = await lookup(id);
      result = row ? { found: true, row } : { found: false, id };
    }
    return renderVerify(res, { id, result });
  } catch (err) {
    return next(err);
  }
});

router.post('/verify', verifyLimiter, requireCsrf, async (req, res, next) => {
  try {
    const id = String(req.body.verificationId || '').trim();
    const row = await lookup(id);
    return renderVerify(res, { id, result: row ? { found: true, row } : { found: false, id } });
  } catch (err) {
    return next(err);
  }
});

router.post('/verify/pdf', verifyLimiter, upload.single('pdf'), requireCsrf, async (req, res, next) => {
  try {
    const id = String(req.body.verificationId || '').trim();
    const row = await lookup(id);
    if (!row) return renderVerify(res, { id, result: { found: false, id } });
    if (!row.pdf_hash) return renderVerify(res, { id, result: { found: true, row }, fileCheck: 'none' });
    if (!req.file) return renderVerify(res, { id, result: { found: true, row }, error: 'Choose the PDF you want to check.' });
    const hash = sha256Hex(req.file.buffer);
    return renderVerify(res, { id, result: { found: true, row }, fileCheck: hash === row.pdf_hash });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
