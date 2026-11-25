const express = require('express');
const multer = require('multer');

const config = require('../config');
const db = require('../db');
const service = require('../projectService');
const storage = require('../storage');
const { audit } = require('../audit');
const { ensureCsrf, requireCsrf, accessBlocked } = require('../auth');
const {
  companyLogin: companyLoginLimiter,
  clientLogin: clientLoginLimiter,
  otp: otpLimiter,
  verify: verifyLimiter
} = require('../rateLimiters');
const {
  scryptHash,
  scryptVerify,
  generateProjectId,
  generateClientPassword,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  uuid,
  generateVerificationId,
  sha256Hex,
  canonicalJson,
  decodeImageDataUrl,
  imageKindFromBuffer,
  randomString,
  isValidEmail
} = require('../security');
const { parseChecklist, rowsToMilestones } = require('../checklist');
const {
  listCompanyUsers,
  addCompanyAdmin,
  changeCompanyUserPassword
} = require('../companyUsers');
const { buildCertificatePDF } = require('../pdf');
const { sendOtpEmail, sendCertificateEmail } = require('../email');
const { isoDate, fmt, inviteText, safeFilename } = require('../helpers');

const router = express.Router();
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 4);
const maxPdfMb = Number(process.env.MAX_PDF_MB || 15);

const uploadChecklistOrShot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 }
});

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPdfMb * 1024 * 1024, files: 1 }
});

function requireCompanyApi(req, res, next) {
  if (req.companyUser) return next();
  return res.status(401).json({ ok: false, error: 'Sign in to continue.' });
}

async function loadClientTokenApi(req, res, next) {
  try {
    const bundle = await service.getProjectByToken(req.params.token);
    if (!bundle) {
      return res.status(404).json({ ok: false, error: 'This UAT link does not exist.' });
    }
    req.bundle = bundle;
    const session = req.session.client;
    req.clientAuthed = Boolean(
      session &&
        session.projectId === bundle.project.id &&
        session.token === bundle.link.token
    );
    if (req.clientAuthed && session.tester) {
      req.tester = session.tester;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireClientAuthApi(req, res, next) {
  if (!req.clientAuthed) {
    return res.status(401).json({
      ok: false,
      error: 'Enter the password from your invitation to continue.'
    });
  }
  const blocked = accessBlocked(req.bundle);
  if (blocked) {
    return res.status(403).json({
      ok: false,
      blockedReason: blocked,
      error: blocked === 'revoked' ? 'Client access is turned off.' : 'This link has expired.'
    });
  }
  return next();
}

function requireClientSessionApi(req, res, next) {
  if (!req.clientAuthed) {
    return res.status(401).json({
      ok: false,
      error: 'Enter the password from your invitation to continue.'
    });
  }
  return next();
}

function requireTesterApi(req, res, next) {
  if (!req.tester) {
    return res.status(400).json({
      ok: false,
      needsTester: true,
      error: 'Enter your name and work email first.'
    });
  }
  return next();
}

function allComplete(bundle) {
  return bundle.stats.total > 0 && bundle.stats.done === bundle.stats.total;
}

function imageNameFromKey(key) {
  if (!key) return null;
  const parts = String(key).split('/');
  return parts[parts.length - 1] || null;
}

function serializeProjectSummary(bundle) {
  const { project, link, signoff, stats, milestones, currentIndex } = bundle;
  const currentMs =
    currentIndex >= 0 && milestones[currentIndex]
      ? milestones[currentIndex].name
      : signoff
      ? 'Signed off'
      : stats.total > 0 && stats.done === stats.total
      ? 'Ready for Sign-Off'
      : 'Milestone 1';

  return {
    id: project.id,
    token: link.token,
    product_name: project.product_name,
    version: project.version,
    client_name: project.client_name,
    owner_name: project.owner_name,
    owner_email: project.owner_email || null,
    checklist_filename: project.checklist_filename || 'snapshot.xlsx',
    created_at: project.created_at,
    expires_at: link.expires_at,
    revoked_at: link.revoked_at || null,
    signed_at: signoff ? signoff.signed_at : null,
    current_milestone: currentMs
  };
}

function serializeCertificate(signoff, bundleOrRow, viewer = 'public') {
  if (!signoff) return null;
  const token = bundleOrRow.link ? bundleOrRow.link.token : bundleOrRow.token;
  const projectId = bundleOrRow.project ? bundleOrRow.project.id : signoff.project_id;
  const productName = bundleOrRow.product
    ? bundleOrRow.product.name
    : bundleOrRow.product_name;
  const version = bundleOrRow.project
    ? bundleOrRow.project.version
    : bundleOrRow.version;
  const clientName = bundleOrRow.client
    ? bundleOrRow.client.name
    : bundleOrRow.client_name;
  const ownerName = bundleOrRow.project
    ? bundleOrRow.project.owner_name
    : bundleOrRow.owner_name;

  let signatureUrl = null;
  let pdfUrl = null;
  if (viewer === 'company') {
    signatureUrl = signoff.signature_key ? `/company/projects/${projectId}/signature` : null;
    pdfUrl = signoff.pdf_key ? `/company/projects/${projectId}/certificate.pdf` : null;
  } else if (viewer === 'client') {
    signatureUrl = signoff.signature_key ? `/p/${token}/signature` : null;
    pdfUrl = signoff.pdf_key ? `/p/${token}/certificate.pdf` : null;
  }

  return {
    verification_id: signoff.verification_id,
    project_id: projectId,
    token,
    product_name: productName,
    version,
    client_name: clientName,
    owner_name: ownerName,
    signer_name: signoff.signer_name,
    signer_designation: signoff.signer_designation,
    signer_email: signoff.signer_email,
    otp_verified_at: signoff.otp_verified_at,
    signed_at: signoff.signed_at,
    signature_kind: signoff.signature_kind === 'typed' ? 'typed' : 'drawn',
    typed_signature: signoff.signer_name,
    signature_url: signatureUrl,
    pdf_url: pdfUrl,
    has_pdf_hash: Boolean(signoff.pdf_hash),
    ip: signoff.ip || '',
    record_hash: signoff.record_hash,
    pdf_hash: signoff.pdf_hash || ''
  };
}

function serializeBundle(bundle, { viewer = 'client' } = {}) {
  const project = serializeProjectSummary(bundle);
  const token = bundle.link.token;
  const projectId = bundle.project.id;

  const milestones = bundle.milestones.map((ms) => ({
    id: ms.id,
    position: ms.position,
    name: ms.name,
    items: ms.items.map((it) => ({
      id: it.id,
      code: it.code,
      title: it.title,
      steps: it.steps || '',
      expected: it.expected || '',
      mandatory: Boolean(it.mandatory),
      evidence: Boolean(it.evidence),
      status: it.status || null,
      comment: it.comment || '',
      fix_note: it.fix_note || null,
      tester_name: it.tester_name || null,
      tester_email: it.tester_email || null,
      tested_at: it.tested_at || null,
      screenshotName: imageNameFromKey(it.image_key),
      screenshotUrl: it.image_key
        ? viewer === 'company'
          ? `/company/projects/${projectId}/items/${it.id}/screenshot`
          : `/p/${token}/items/${it.id}/screenshot`
        : null
    }))
  }));

  return {
    project,
    milestones,
    stats: bundle.stats,
    status: bundle.status,
    expired: bundle.expired,
    signoff: bundle.signoff ? serializeCertificate(bundle.signoff, bundle, viewer) : null
  };
}

function serializeActivity(rows) {
  return rows.map((r, idx) => ({
    id: `ev-${idx}-${new Date(r.at).getTime()}`,
    action: r.action,
    detail: r.detail || '',
    actor: r.actor || 'system',
    ip: r.ip || '',
    timestamp: fmt(r.at)
  }));
}

async function lookupCertificateById(verificationId) {
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

async function readDevOtp(email) {
  if (config.isProd || !email) return null;
  const { rows } = await db.query(
    'SELECT body FROM dev_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1',
    [email]
  );
  if (!rows.length) return null;
  const match = /\b(\d{6})\b/.exec(rows[0].body);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Bootstrap & Public Verification
// ---------------------------------------------------------------------------
router.get('/bootstrap', (req, res) => {
  const csrfToken = ensureCsrf(req);
  const clientSess = req.session.client || null;
  res.json({
    ok: true,
    csrfToken,
    isDev: !config.isProd,
    appBaseUrl: config.appBaseUrl,
    companyUser: req.companyUser
      ? {
          id: req.companyUser.id,
          email: req.companyUser.email,
          name: req.companyUser.name
        }
      : null,
    clientSession: clientSess
      ? {
          token: clientSess.token,
          tester: clientSess.tester || null
        }
      : null
  });
});

router.get('/verify', verifyLimiter, async (req, res, next) => {
  try {
    const id = String(req.query.id || '').trim().toUpperCase();
    if (!id) {
      return res.json({ ok: true, id: '', found: false, cert: null });
    }
    const row = await lookupCertificateById(id);
    return res.json({
      ok: true,
      id,
      found: Boolean(row),
      cert: row ? serializeCertificate(row, row, 'public') : null
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/verify/pdf',
  verifyLimiter,
  uploadPdf.single('pdf'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const id = String(req.body.verificationId || '').trim().toUpperCase();
      const row = await lookupCertificateById(id);
      if (!row) {
        return res.status(404).json({
          ok: false,
          found: false,
          error: `No certificate matches "${id}".`
        });
      }
      if (!row.pdf_hash) {
        return res.json({
          ok: true,
          found: true,
          fileCheck: 'none',
          computedHash: null,
          cert: serializeCertificate(row, row, 'public')
        });
      }
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          found: true,
          error: 'Choose the PDF file you want to check.'
        });
      }
      const computedHash = sha256Hex(req.file.buffer);
      return res.json({
        ok: true,
        found: true,
        fileCheck: computedHash === row.pdf_hash ? 'match' : 'mismatch',
        computedHash,
        cert: serializeCertificate(row, row, 'public')
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Company Auth & Workspace
// ---------------------------------------------------------------------------
router.post('/company/login', companyLoginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { rows } = await db.query(
      'SELECT * FROM company_users WHERE lower(email) = lower($1)',
      [email]
    );
    const user = rows[0];

    if (!user || !scryptVerify(password, user.password_hash)) {
      await audit({ actor: email || 'unknown', action: 'company.login_failed', req });
      return res.status(401).json({
        ok: false,
        error: 'That email and password do not match.'
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.companyUserId = user.id;
    const csrfToken = randomString(32);
    req.session.csrfToken = csrfToken;

    await db.query('UPDATE company_users SET last_login_at = now() WHERE id = $1', [
      user.id
    ]);
    await audit({ actor: user.email, action: 'company.login', req });
    return res.json({
      ok: true,
      csrfToken,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/company/logout', requireCsrf, (req, res) => {
  req.session.regenerate(() => {
    const csrfToken = randomString(32);
    req.session.csrfToken = csrfToken;
    res.json({ ok: true, csrfToken });
  });
});

function serializeCompanyUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: fmt(user.created_at),
    last_login_at: user.last_login_at ? fmt(user.last_login_at) : null
  };
}

router.get('/company/users', requireCompanyApi, async (req, res, next) => {
  try {
    const users = await listCompanyUsers();
    return res.json({
      ok: true,
      users: users.map(serializeCompanyUser)
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/company/users', requireCompanyApi, requireCsrf, async (req, res, next) => {
  try {
    const { email, name, password } = req.body || {};
    const { user } = await addCompanyAdmin({
      email,
      name,
      password,
      updateIfExists: false
    });
    await audit({
      actor: req.companyUser.email,
      action: 'company.user_created',
      detail: user.email,
      req
    });
    return res.status(201).json({
      ok: true,
      user: serializeCompanyUser(user)
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    return next(err);
  }
});

router.post(
  '/company/users/:userId/password',
  requireCompanyApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const updated = await changeCompanyUserPassword({
        targetUserId: req.params.userId,
        newPassword,
        currentPassword,
        actingUserId: req.companyUser.id
      });
      await audit({
        actor: req.companyUser.email,
        action:
          String(updated.id) === String(req.companyUser.id)
            ? 'company.password_changed'
            : 'company.user_password_reset',
        detail: updated.email,
        req
      });
      return res.json({
        ok: true,
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name
        }
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ ok: false, error: err.message });
      }
      return next(err);
    }
  }
);

router.get('/company/projects', requireCompanyApi, async (req, res, next) => {
  try {
    const rows = await service.getDashboard();
    const projects = rows.map((r) => ({
      id: r.id,
      token: r.token,
      product_name: r.product_name,
      version: r.version,
      client_name: r.client_name,
      owner_name: r.owner_name,
      owner_email: null,
      checklist_filename: 'snapshot.xlsx',
      created_at: r.created_at,
      expires_at: r.expires_at,
      revoked_at: r.revoked_at || null,
      signed_at: r.signed_at || null,
      current_milestone:
        r.current_milestone ||
        (r.verification_id
          ? 'Signed off'
          : r.status === 'ready'
          ? 'Ready for Sign-Off'
          : 'Milestone 1'),
      status: r.status,
      expired: r.expired,
      stats: {
        total: Number(r.total || 0),
        done: Number(r.done || 0),
        na: Number(r.na || 0),
        fail: Number(r.fail || 0),
        retest: Number(r.retest || 0),
        tested: Number(r.tested || 0)
      }
    }));

    const stats = {
      inTesting: projects.filter((p) =>
        ['in-progress', 'not-started'].includes(p.status)
      ).length,
      itemsToFix: projects.reduce((n, p) => n + p.stats.fail, 0),
      waitingSignoff: projects.filter((p) => p.status === 'ready').length,
      signedOff: projects.filter((p) => p.status === 'signed').length
    };

    return res.json({ ok: true, projects, stats });
  } catch (err) {
    return next(err);
  }
});

router.get('/company/new-project-meta', requireCompanyApi, async (req, res, next) => {
  try {
    const products = (await db.query('SELECT id, name FROM products ORDER BY name')).rows;
    const clients = (await db.query('SELECT id, name FROM clients ORDER BY name')).rows;
    return res.json({
      ok: true,
      products,
      clients,
      defaults: {
        ownerName: req.companyUser.name,
        ownerEmail: req.companyUser.email,
        expiry: isoDate(Date.now() + 30 * 86400000)
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/company/projects/preview',
  requireCompanyApi,
  uploadChecklistOrShot.single('checklist'),
  requireCsrf,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          errors: ['Choose an .xlsx or .csv checklist first.']
        });
      }
      const parsed = await parseChecklist(req.file.buffer, req.file.originalname);
      if (parsed.errors.length) {
        return res.status(400).json({
          ok: false,
          fileName: req.file.originalname,
          errors: parsed.errors
        });
      }
      const milestones = rowsToMilestones(parsed.rows).map((m) => ({
        name: m.name,
        count: m.items.length,
        required: m.items.filter((i) => i.mandatory).length
      }));
      return res.json({
        ok: true,
        fileName: req.file.originalname,
        total: parsed.rows.length,
        milestones
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/company/projects',
  requireCompanyApi,
  uploadChecklistOrShot.single('checklist'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const values = {
        productMode: body.productMode === 'new' ? 'new' : 'existing',
        productId: String(body.productId || ''),
        newProduct: String(body.newProduct || '').trim(),
        clientMode: body.clientMode === 'new' ? 'new' : 'existing',
        clientId: String(body.clientId || ''),
        newClient: String(body.newClient || '').trim(),
        version: String(body.version || '').trim(),
        ownerName: String(body.ownerName || '').trim(),
        ownerEmail: String(body.ownerEmail || '').trim(),
        expiry: String(body.expiry || '')
      };

      const errors = [];
      if (values.productMode === 'new') {
        if (!values.newProduct) errors.push('Enter a name for the new product.');
      } else {
        const exists = await db.query('SELECT 1 FROM products WHERE id = $1', [
          values.productId
        ]);
        if (!exists.rows.length) errors.push('Choose a product, or add a new one.');
      }

      if (values.clientMode === 'new') {
        if (!values.newClient) errors.push('Enter a name for the new client.');
      } else {
        const exists = await db.query('SELECT 1 FROM clients WHERE id = $1', [
          values.clientId
        ]);
        if (!exists.rows.length) errors.push('Choose a client, or add a new one.');
      }

      if (!values.version) errors.push('Enter a release or version, such as v1.0.');
      if (!values.ownerName) errors.push('Enter the company contact’s name.');
      if (values.ownerEmail && !isValidEmail(values.ownerEmail)) {
        errors.push('Enter a valid company contact email, or leave it blank.');
      }
      if (!values.expiry) {
        errors.push('Choose how long the link stays available.');
      } else if (values.expiry < isoDate(Date.now())) {
        errors.push('The link’s end date is in the past.');
      }
      if (!req.file) errors.push('Upload the checklist as an .xlsx or .csv file.');

      let parsed = { rows: [], errors: [] };
      if (req.file) {
        try {
          parsed = await parseChecklist(req.file.buffer, req.file.originalname);
        } catch (err) {
          parsed.errors = [err.message];
        }
      }

      if (errors.length || parsed.errors.length) {
        return res.status(400).json({
          ok: false,
          errors,
          checklistErrors: parsed.errors
        });
      }

      const product =
        values.productMode === 'new'
          ? await service.findOrCreateProduct(values.newProduct)
          : { id: values.productId };
      const client =
        values.clientMode === 'new'
          ? await service.findOrCreateClient(values.newClient)
          : { id: values.clientId };

      let token;
      for (let i = 0; i < 30; i += 1) {
        const candidate = generateProjectId();
        const taken = await db.query(
          'SELECT 1 FROM access_links WHERE upper(token) = upper($1)',
          [candidate]
        );
        if (!taken.rows.length) {
          token = candidate;
          break;
        }
      }
      if (!token) throw new Error('Could not allocate a project ID');

      const password = generateClientPassword();
      const passwordHash = scryptHash(password);

      const projectId = await service.createProject({
        productId: product.id,
        clientId: client.id,
        version: values.version,
        ownerName: values.ownerName,
        ownerEmail: values.ownerEmail || null,
        createdBy: req.companyUser.id,
        rows: parsed.rows,
        token,
        passwordHash,
        expiresAt: values.expiry,
        checklistFilename: req.file.originalname
      });

      const checklistKey = `projects/${projectId}/checklist/${Date.now()}-${safeFilename(
        req.file.originalname
      )}`;
      await storage.put(
        checklistKey,
        req.file.buffer,
        req.file.mimetype || 'application/octet-stream'
      );
      await db.query('UPDATE projects SET checklist_key = $2 WHERE id = $1', [
        projectId,
        checklistKey
      ]);

      await audit({
        projectId,
        actor: req.companyUser.email,
        action: 'project.created',
        detail: `${token} · ${parsed.rows.length} items`,
        req
      });

      const bundle = await service.getProjectBundle(projectId);
      const activity = serializeActivity(await service.getAudit(projectId, 50));

      return res.status(201).json({
        ok: true,
        projectId,
        oneTimePassword: password,
        invite: inviteText(bundle, password),
        bundle: serializeBundle(bundle, { viewer: 'company' }),
        activity
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/company/projects/:id', requireCompanyApi, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) {
      return res.status(404).json({ ok: false, error: 'Project not found.' });
    }
    const activity = serializeActivity(await service.getAudit(bundle.project.id, 50));
    const created =
      req.session.newPassword && req.session.newPassword.projectId === bundle.project.id
        ? req.session.newPassword
        : null;
    delete req.session.newPassword;

    return res.json({
      ok: true,
      bundle: serializeBundle(bundle, { viewer: 'company' }),
      activity,
      oneTimePassword: created ? created.password : null,
      invite: created ? inviteText(bundle, created.password) : null
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/company/projects/:id/password',
  requireCompanyApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = await service.getProjectBundle(req.params.id);
      if (!bundle) {
        return res.status(404).json({ ok: false, error: 'Project not found.' });
      }
      const password = generateClientPassword();
      await service.rotatePassword(bundle.project.id, scryptHash(password));
      await audit({
        projectId: bundle.project.id,
        actor: req.companyUser.email,
        action: 'access.password_rotated',
        detail: 'Client password replaced',
        req
      });
      const activity = serializeActivity(await service.getAudit(bundle.project.id, 50));
      return res.json({
        ok: true,
        oneTimePassword: password,
        invite: inviteText(bundle, password),
        activity
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/company/projects/:id/expiry',
  requireCompanyApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = await service.getProjectBundle(req.params.id);
      if (!bundle) {
        return res.status(404).json({ ok: false, error: 'Project not found.' });
      }
      const date = String(req.body.expiry || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < isoDate(Date.now())) {
        return res.status(400).json({
          ok: false,
          error: 'Choose an end date today or later.'
        });
      }
      await service.setExpiry(bundle.project.id, date);
      await audit({
        projectId: bundle.project.id,
        actor: req.companyUser.email,
        action: 'access.expiry_changed',
        detail: `Available until ${date}`,
        req
      });
      const fresh = await service.getProjectBundle(bundle.project.id);
      const activity = serializeActivity(await service.getAudit(bundle.project.id, 50));
      return res.json({
        ok: true,
        bundle: serializeBundle(fresh, { viewer: 'company' }),
        activity
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/company/projects/:id/revoke',
  requireCompanyApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = await service.getProjectBundle(req.params.id);
      if (!bundle) {
        return res.status(404).json({ ok: false, error: 'Project not found.' });
      }
      const revoke = !bundle.link.revoked_at;
      await service.setRevoked(bundle.project.id, revoke);
      await audit({
        projectId: bundle.project.id,
        actor: req.companyUser.email,
        action: revoke ? 'access.revoked' : 'access.restored',
        req
      });
      const fresh = await service.getProjectBundle(bundle.project.id);
      const activity = serializeActivity(await service.getAudit(bundle.project.id, 50));
      return res.json({
        ok: true,
        revoked: revoke,
        bundle: serializeBundle(fresh, { viewer: 'company' }),
        activity
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/company/projects/:id/items/:itemId/fix',
  requireCompanyApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = await service.getProjectBundle(req.params.id);
      if (!bundle) {
        return res.status(404).json({ ok: false, error: 'Project not found.' });
      }
      const item = bundle.milestones
        .flatMap((m) => m.items)
        .find((i) => i.id === req.params.itemId);
      if (!item) {
        return res.status(404).json({ ok: false, error: 'Checklist item not found.' });
      }
      if (item.status !== 'fail') {
        return res.status(400).json({
          ok: false,
          error: 'Only a failed item can be sent for retest.'
        });
      }
      const note = String(req.body.fixNote || '').trim();
      if (note.length < 3) {
        return res.status(400).json({
          ok: false,
          error: 'Enter at least 3 characters describing the fix.'
        });
      }
      await service.addResult({
        itemId: item.id,
        status: 'retest',
        fixNote: note,
        createdBy: req.companyUser.name
      });
      await audit({
        projectId: bundle.project.id,
        actor: req.companyUser.email,
        action: 'item.retest',
        detail: `${item.code}: ${note}`,
        req
      });
      const fresh = await service.getProjectBundle(bundle.project.id);
      const activity = serializeActivity(await service.getAudit(bundle.project.id, 50));
      return res.json({
        ok: true,
        code: item.code,
        bundle: serializeBundle(fresh, { viewer: 'company' }),
        activity
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Client Portal Entry, Auth, Checklist, Sign-Off & Certificate
// ---------------------------------------------------------------------------
async function authenticateClientToken(req, res, next, { token, password }) {
  const bundle = await service.getProjectByToken(token);
  if (!bundle) {
    return res.status(404).json({
      ok: false,
      error: `Project ID “${token}” was not found. Check your Project ID or paste the full link.`
    });
  }

  const blocked = accessBlocked(bundle);
  if (blocked) {
    return res.status(403).json({
      ok: false,
      blockedReason: blocked,
      project: serializeProjectSummary(bundle),
      error: blocked === 'revoked' ? 'Client access is turned off.' : 'This link has expired.'
    });
  }

  const { rows: linkRows } = await db.query(
    'SELECT id, password_hash, failed_attempts, locked_until FROM access_links WHERE project_id = $1',
    [bundle.project.id]
  );
  const link = linkRows[0];
  if (!link) {
    return res.status(404).json({ ok: false, error: 'Project access link not found.' });
  }

  if (
    link.failed_attempts >= 5 &&
    link.locked_until &&
    new Date(link.locked_until).getTime() > Date.now()
  ) {
    const waitMinutes = Math.max(
      1,
      Math.ceil((new Date(link.locked_until).getTime() - Date.now()) / 60000)
    );
    return res.status(429).json({
      ok: false,
      error: `Too many failed password attempts. Access is locked for ${waitMinutes} minute(s).`
    });
  }

  if (!scryptVerify(password, link.password_hash)) {
    await service.recordAccessFailure(link.id);
    await audit({
      projectId: bundle.project.id,
      actor: 'unknown visitor',
      action: 'client.login_failed',
      detail: `Failed password on project ${bundle.link.token}`,
      req
    });
    return res.status(401).json({
      ok: false,
      error: 'That password did not match this Project ID.'
    });
  }

  await service.clearAccessFailures(link.id);
  const preservedCompanyUserId = req.session.companyUserId || null;
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  if (preservedCompanyUserId) {
    req.session.companyUserId = preservedCompanyUserId;
  }
  req.session.client = {
    projectId: bundle.project.id,
    token: bundle.link.token
  };
  const csrfToken = randomString(32);
  req.session.csrfToken = csrfToken;

  await audit({
    projectId: bundle.project.id,
    actor: 'client',
    action: 'client.login',
    req
  });

  return res.json({
    ok: true,
    csrfToken,
    token: bundle.link.token,
    signed: Boolean(bundle.signoff),
    bundle: serializeBundle(bundle, { viewer: 'client' })
  });
}

router.post('/client/enter', clientLoginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const rawToken = String(req.body.token || '').trim();
    const match = /(?:^|\/p\/)([A-Za-z0-9_-]+)\/?$/.exec(rawToken);
    const token = (match ? match[1] : rawToken).toUpperCase();
    const password = String(req.body.password || '');

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Enter a Project ID or paste your invitation link.'
      });
    }
    if (!password) {
      return res.status(400).json({
        ok: false,
        error: 'Enter the password from your invitation.'
      });
    }
    return await authenticateClientToken(req, res, next, { token, password });
  } catch (err) {
    return next(err);
  }
});

router.get('/p/:token', loadClientTokenApi, (req, res) => {
  const bundle = req.bundle;
  const blockedReason = accessBlocked(bundle);
  const summary = serializeProjectSummary(bundle);

  if (blockedReason) {
    return res.json({
      ok: true,
      authed: false,
      blockedReason,
      project: summary,
      tester: null,
      bundle: null
    });
  }

  if (!req.clientAuthed) {
    return res.json({
      ok: true,
      authed: false,
      blockedReason: null,
      project: summary,
      tester: null,
      bundle: null
    });
  }

  return res.json({
    ok: true,
    authed: true,
    blockedReason: null,
    project: summary,
    tester: req.tester || null,
    bundle: serializeBundle(bundle, { viewer: 'client' })
  });
});

router.post(
  '/p/:token/login',
  loadClientTokenApi,
  clientLoginLimiter,
  requireCsrf,
  async (req, res, next) => {
    try {
      const password = String(req.body.password || '');
      if (!password) {
        return res.status(400).json({
          ok: false,
          error: 'Enter the password from your invitation.'
        });
      }
      return await authenticateClientToken(req, res, next, {
        token: req.bundle.link.token,
        password
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/p/:token/tester',
  loadClientTokenApi,
  requireClientAuthApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      if (!name || !isValidEmail(email)) {
        return res.status(400).json({
          ok: false,
          error: 'Enter your full name and a valid work email.'
        });
      }
      await service.addTester(req.bundle.project.id, name, email);
      req.session.client.tester = { name, email };
      await audit({
        projectId: req.bundle.project.id,
        actor: name,
        action: 'client.tester_registered',
        detail: email,
        req
      });
      return res.json({ ok: true, tester: { name, email } });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/p/:token/items/:itemId/result',
  loadClientTokenApi,
  requireClientAuthApi,
  requireTesterApi,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = req.bundle;
      if (bundle.signoff) {
        return res.status(400).json({
          ok: false,
          error: 'Project has already been signed off.'
        });
      }

      const item = bundle.milestones
        .flatMap((m) => m.items)
        .find((i) => i.id === req.params.itemId);
      if (!item) {
        return res.status(404).json({ ok: false, error: 'Checklist item not found.' });
      }

      const mi = bundle.milestones.findIndex((m) =>
        m.items.some((i) => i.id === item.id)
      );
      if (bundle.states[mi] === 'locked') {
        return res.status(400).json({
          ok: false,
          error: 'Finish the earlier milestone first.'
        });
      }

      const status = String(req.body.status || '');
      const comment = String(req.body.comment || '').trim();

      if (!['pass', 'fail', 'na'].includes(status)) {
        return res.status(400).json({
          ok: false,
          error: 'Choose Pass, Fail or Not applicable.'
        });
      }
      if (status === 'fail' && !comment) {
        return res.status(400).json({
          ok: false,
          error: `Describe what went wrong for ${item.code} before marking it failed.`
        });
      }
      if (status === 'na' && item.mandatory) {
        return res.status(400).json({
          ok: false,
          error: `${item.code} is required and cannot be marked not applicable.`
        });
      }

      await service.addResult({
        itemId: item.id,
        status,
        comment,
        testerName: req.tester.name,
        testerEmail: req.tester.email,
        createdBy: req.tester.name
      });
      await audit({
        projectId: bundle.project.id,
        actor: req.tester.name,
        action: 'item.result',
        detail: `${item.code}: ${status}${comment ? ` — ${comment}` : ''}`,
        req
      });

      const fresh = await service.getProjectBundle(bundle.project.id);
      return res.json({
        ok: true,
        bundle: serializeBundle(fresh, { viewer: 'client' })
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/p/:token/items/:itemId/screenshot',
  loadClientTokenApi,
  requireClientAuthApi,
  requireTesterApi,
  uploadChecklistOrShot.single('screenshot'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = req.bundle;
      if (bundle.signoff) {
        return res.status(400).json({
          ok: false,
          error: 'Project has already been signed off.'
        });
      }

      const item = bundle.milestones
        .flatMap((m) => m.items)
        .find((i) => i.id === req.params.itemId);
      if (!item) {
        return res.status(404).json({ ok: false, error: 'Checklist item not found.' });
      }
      const mi = bundle.milestones.findIndex((m) =>
        m.items.some((i) => i.id === item.id)
      );
      if (bundle.states[mi] === 'locked') {
        return res.status(400).json({
          ok: false,
          error: 'Finish the earlier milestone first.'
        });
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Choose a PNG or JPG screenshot.' });
      }
      const kind = imageKindFromBuffer(req.file.buffer);
      if (!kind || kind === 'webp') {
        return res.status(400).json({ ok: false, error: 'Attach a PNG or JPG image.' });
      }

      const key = `projects/${bundle.project.id}/screenshots/${uuid()}.${
        kind === 'jpeg' ? 'jpg' : kind
      }`;
      await storage.put(
        key,
        req.file.buffer,
        kind === 'jpeg' ? 'image/jpeg' : 'image/png'
      );
      await db.query(
        'UPDATE checklist_items SET image_key = $2 WHERE id = $1 AND project_id = $3',
        [item.id, key, bundle.project.id]
      );
      await audit({
        projectId: bundle.project.id,
        actor: req.tester.name,
        action: 'item.screenshot',
        detail: item.code,
        req
      });
      const fresh = await service.getProjectBundle(bundle.project.id);
      return res.json({
        ok: true,
        bundle: serializeBundle(fresh, { viewer: 'client' })
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/p/:token/signoff',
  loadClientTokenApi,
  requireClientAuthApi,
  requireTesterApi,
  async (req, res, next) => {
    try {
      const bundle = req.bundle;
      if (bundle.signoff) {
        return res.json({
          ok: true,
          signed: true,
          bundle: serializeBundle(bundle, { viewer: 'client' })
        });
      }
      if (req.query.restart === '1') {
        delete req.session.signoff;
      }
      if (!allComplete(bundle)) {
        return res.status(400).json({
          ok: false,
          error: 'Every milestone must be complete before sign-off.',
          bundle: serializeBundle(bundle, { viewer: 'client' })
        });
      }

      const state = req.session.signoff || null;
      let step = 1;
      let devCode = null;
      if (state && state.verifiedAt) {
        step = 3;
      } else if (state && state.challengeId) {
        step = 2;
        devCode = await readDevOtp(state.email);
      }

      return res.json({
        ok: true,
        signed: false,
        step,
        state: state
          ? {
              name: state.name || '',
              designation: state.designation || '',
              email: state.email || '',
              verifiedAt: state.verifiedAt || null
            }
          : null,
        devCode,
        bundle: serializeBundle(bundle, { viewer: 'client' })
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/p/:token/signoff/start',
  loadClientTokenApi,
  requireClientAuthApi,
  requireTesterApi,
  otpLimiter,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = req.bundle;
      if (bundle.signoff) {
        return res.status(400).json({ ok: false, error: 'Project is already signed off.' });
      }
      if (!allComplete(bundle)) {
        return res.status(400).json({
          ok: false,
          error: 'Every milestone must be complete before sign-off.'
        });
      }

      const name = String(req.body.name || '').trim();
      const designation = String(req.body.designation || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();

      if (!name || !designation || !isValidEmail(email)) {
        return res.status(400).json({
          ok: false,
          error: 'Enter the signer’s full name, designation and a valid work email.'
        });
      }

      const code = generateOtp();
      const challengeId = uuid();
      await db.query(
        `UPDATE otp_challenges SET expires_at = now()
          WHERE project_id = $1 AND email = $2 AND verified_at IS NULL`,
        [bundle.project.id, email]
      );
      await db.query(
        `INSERT INTO otp_challenges (id, project_id, email, code_hash, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '10 minutes')`,
        [challengeId, bundle.project.id, email, hashOtp(code)]
      );
      await sendOtpEmail({
        to: email,
        productName: bundle.product.name,
        version: bundle.project.version,
        clientName: bundle.client.name,
        code
      });

      req.session.signoff = { challengeId, name, designation, email };
      await audit({
        projectId: bundle.project.id,
        actor: name,
        action: 'signoff.otp_requested',
        detail: email,
        req
      });

      const devCode = await readDevOtp(email);
      return res.json({
        ok: true,
        step: 2,
        devCode,
        state: { name, designation, email, verifiedAt: null },
        message: `A one-time code was sent to ${email}.`
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/p/:token/signoff/verify',
  loadClientTokenApi,
  requireClientAuthApi,
  requireTesterApi,
  otpLimiter,
  requireCsrf,
  async (req, res, next) => {
    try {
      const state = req.session.signoff;
      if (!state || !state.challengeId) {
        return res.status(400).json({
          ok: false,
          step: 1,
          error: 'Start the sign-off again to get a new code.'
        });
      }

      const { rows } = await db.query(
        'SELECT * FROM otp_challenges WHERE id = $1 AND project_id = $2',
        [state.challengeId, req.bundle.project.id]
      );
      const challenge = rows[0];
      if (!challenge) {
        delete req.session.signoff;
        return res.status(400).json({
          ok: false,
          step: 1,
          error: 'That code has expired. Start the sign-off again.'
        });
      }
      if (challenge.verified_at) {
        state.verifiedAt = new Date(challenge.verified_at).toISOString();
        return res.json({
          ok: true,
          step: 3,
          state: {
            name: state.name,
            designation: state.designation,
            email: state.email,
            verifiedAt: state.verifiedAt
          }
        });
      }
      if (new Date(challenge.expires_at).getTime() < Date.now()) {
        return res.status(400).json({
          ok: false,
          error: 'That code has expired. Send a new one.'
        });
      }
      if (challenge.attempts >= 5) {
        return res.status(400).json({
          ok: false,
          error: 'Too many incorrect codes. Send a new one.'
        });
      }

      const code = String(req.body.code || '').trim();
      if (!verifyOtpHash(code, challenge.code_hash)) {
        await db.query(
          'UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1',
          [challenge.id]
        );
        await audit({
          projectId: req.bundle.project.id,
          actor: state.name,
          action: 'signoff.otp_failed',
          req
        });
        return res.status(400).json({
          ok: false,
          error: 'That code does not match. Check the email or send a new code.'
        });
      }

      await db.query('UPDATE otp_challenges SET verified_at = now() WHERE id = $1', [
        challenge.id
      ]);
      state.verifiedAt = new Date().toISOString();
      await audit({
        projectId: req.bundle.project.id,
        actor: state.name,
        action: 'signoff.otp_verified',
        detail: state.email,
        req
      });
      return res.json({
        ok: true,
        step: 3,
        state: {
          name: state.name,
          designation: state.designation,
          email: state.email,
          verifiedAt: state.verifiedAt
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/p/:token/signoff/submit',
  loadClientTokenApi,
  requireClientAuthApi,
  requireTesterApi,
  otpLimiter,
  requireCsrf,
  async (req, res, next) => {
    try {
      const bundle = req.bundle;
      if (bundle.signoff) {
        return res.json({
          ok: true,
          bundle: serializeBundle(bundle, { viewer: 'client' })
        });
      }

      const state = req.session.signoff;
      if (!state || !state.verifiedAt || !state.challengeId) {
        return res.status(400).json({
          ok: false,
          error: 'Verify your email before signing.'
        });
      }

      const { rows: challengeRows } = await db.query(
        'SELECT verified_at FROM otp_challenges WHERE id = $1 AND project_id = $2',
        [state.challengeId, bundle.project.id]
      );
      if (!challengeRows.length || !challengeRows[0].verified_at) {
        return res.status(400).json({
          ok: false,
          error: 'Verify your email before signing.'
        });
      }
      if (!allComplete(bundle)) {
        return res.status(400).json({
          ok: false,
          error: 'Every milestone must be complete before sign-off.'
        });
      }
      if (!req.body.consent) {
        return res.status(400).json({
          ok: false,
          error: 'Tick the confirmation box to sign.'
        });
      }

      const kind = req.body.signatureKind === 'typed' ? 'typed' : 'drawn';
      let signatureBuffer = null;
      if (kind === 'drawn') {
        const decoded = decodeImageDataUrl(req.body.signature, ['png', 'jpeg']);
        if (!decoded) {
          return res.status(400).json({
            ok: false,
            error: 'Draw your signature above the line.'
          });
        }
        signatureBuffer = decoded.buffer;
      } else {
        const typed = String(req.body.signatureName || state.name).trim();
        if (!typed) {
          return res.status(400).json({
            ok: false,
            error: 'Type your full name to sign.'
          });
        }
      }

      const signedAt = new Date();
      const otpVerifiedAt = new Date(challengeRows[0].verified_at);

      let verificationId;
      for (let i = 0; i < 30; i += 1) {
        const candidate = generateVerificationId();
        const taken = await db.query(
          'SELECT 1 FROM signoffs WHERE verification_id = $1',
          [candidate]
        );
        if (!taken.rows.length) {
          verificationId = candidate;
          break;
        }
      }
      if (!verificationId) throw new Error('Could not allocate a verification ID');

      const summary = bundle.milestones.map((m) => ({
        name: m.name,
        total: m.items.length,
        pass: m.items.filter((i) => i.status === 'pass').length,
        na: m.items.filter((i) => i.status === 'na').length,
        completedAt: m.items.reduce(
          (max, it) =>
            Math.max(max, it.tested_at ? new Date(it.tested_at).getTime() : 0),
          0
        )
      }));

      const record = {
        projectId: bundle.link.token,
        product: bundle.product.name,
        version: bundle.project.version,
        client: bundle.client.name,
        owner: bundle.project.owner_name,
        milestones: bundle.milestones.map((m) => ({
          name: m.name,
          items: m.items.map((it) => ({
            code: it.code,
            status: it.status,
            comment: it.comment || '',
            tester: it.tester_name || null,
            testedAt: it.tested_at ? new Date(it.tested_at).toISOString() : null
          }))
        })),
        signer: {
          name: state.name,
          designation: state.designation,
          email: state.email
        },
        otpVerifiedAt: otpVerifiedAt.toISOString(),
        signedAt: signedAt.toISOString(),
        verificationId
      };
      const recordHash = sha256Hex(canonicalJson(record));
      const signoffId = uuid();

      try {
        await db.query(
          `INSERT INTO signoffs
             (id, project_id, verification_id, signer_name, signer_designation, signer_email,
              otp_verified_at, signature_kind, signed_at, ip, user_agent, record_json, record_hash, summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            signoffId,
            bundle.project.id,
            verificationId,
            state.name,
            state.designation,
            state.email,
            otpVerifiedAt,
            kind,
            signedAt,
            req.ip,
            req.get('user-agent'),
            JSON.stringify(record),
            recordHash,
            JSON.stringify(summary)
          ]
        );
      } catch (err) {
        if (err.code === '23505') {
          const freshExisting = await service.getProjectBundle(bundle.project.id);
          return res.json({
            ok: true,
            bundle: serializeBundle(freshExisting, { viewer: 'client' })
          });
        }
        throw err;
      }

      if (signatureBuffer) {
        const key = `projects/${bundle.project.id}/signatures/${signoffId}.png`;
        await storage.put(key, signatureBuffer, 'image/png');
        await db.query('UPDATE signoffs SET signature_key = $2 WHERE id = $1', [
          signoffId,
          key
        ]);
      }

      const pdfSignoff = {
        verification_id: verificationId,
        signer_name: state.name,
        signer_designation: state.designation,
        signer_email: state.email,
        otp_verified_at: otpVerifiedAt,
        signed_at: signedAt,
        record_hash: recordHash,
        ip: req.ip
      };
      const pdfBuffer = await buildCertificatePDF({
        project: { ...bundle.project, token: bundle.link.token },
        productName: bundle.product.name,
        clientName: bundle.client.name,
        signoff: pdfSignoff,
        signatureBuffer,
        stats: bundle.stats,
        milestones: bundle.milestones
      });
      const pdfKey = `projects/${bundle.project.id}/certificates/${signoffId}.pdf`;
      const pdfHash = sha256Hex(pdfBuffer);
      await storage.put(pdfKey, pdfBuffer, 'application/pdf');
      await db.query('UPDATE signoffs SET pdf_key = $2, pdf_hash = $3 WHERE id = $1', [
        signoffId,
        pdfKey,
        pdfHash
      ]);

      const verifyUrl = `${config.appBaseUrl}/verify?id=${encodeURIComponent(
        verificationId
      )}`;
      const recipients = new Set([state.email]);
      if (bundle.project.owner_email) recipients.add(bundle.project.owner_email);
      for (const to of recipients) {
        try {
          await sendCertificateEmail({
            to,
            signerName: state.name,
            clientName: bundle.client.name,
            productName: bundle.product.name,
            version: bundle.project.version,
            verificationId,
            signedAt: signedAt.toISOString(),
            pdfBuffer,
            verifyUrl
          });
        } catch (err) {
          console.error('Certificate email failed', to, err);
          await audit({
            projectId: bundle.project.id,
            actor: 'system',
            action: 'email.failed',
            detail: `${to}: ${err.message}`,
            req
          });
        }
      }

      await audit({
        projectId: bundle.project.id,
        actor: state.name,
        action: 'signoff.completed',
        detail: verificationId,
        req
      });
      delete req.session.signoff;

      const fresh = await service.getProjectBundle(bundle.project.id);
      return res.json({
        ok: true,
        bundle: serializeBundle(fresh, { viewer: 'client' })
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/p/:token/certificate',
  loadClientTokenApi,
  requireClientSessionApi,
  (req, res) => {
    if (!req.bundle.signoff) {
      return res.status(404).json({ ok: false, error: 'Certificate not issued yet.' });
    }
    return res.json({
      ok: true,
      bundle: serializeBundle(req.bundle, { viewer: 'client' })
    });
  }
);

router.post('/p/:token/logout', requireCsrf, (req, res) => {
  const preservedCompanyUserId = req.session.companyUserId || null;
  req.session.regenerate(() => {
    if (preservedCompanyUserId) {
      req.session.companyUserId = preservedCompanyUserId;
    }
    const csrfToken = randomString(32);
    req.session.csrfToken = csrfToken;
    res.json({ ok: true, csrfToken });
  });
});

module.exports = router;
