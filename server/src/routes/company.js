const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');

const db = require('../db');
const service = require('../projectService');
const storage = require('../storage');
const { audit } = require('../audit');
const { requireCompany, requireCsrf, flash } = require('../auth');
const { companyLogin: companyLoginLimiter } = require('../rateLimiters');
const {
  scryptHash, scryptVerify, generateProjectId, generateClientPassword, randomString, isValidEmail
} = require('../security');
const { parseChecklist, rowsToMilestones, COLS, TEMPLATE_ROWS } = require('../checklist');
const { isoDate, inviteText, safeFilename, csvEscape } = require('../helpers');

const router = express.Router();
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 4);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 }
});

function renderLogin(res, { error = null, email = '', status = 200 } = {}) {
  return res.status(status).render('company/login', {
    title: 'Company sign in',
    side: 'public',
    error,
    email
  });
}

router.get('/login', (req, res) => {
  if (req.companyUser) return res.redirect('/company');
  return renderLogin(res);
});

router.post('/login', companyLoginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { rows } = await db.query('SELECT * FROM company_users WHERE lower(email) = lower($1)', [email]);
    const user = rows[0];

    if (!user || !scryptVerify(password, user.password_hash)) {
      await audit({ actor: email || 'unknown', action: 'company.login_failed', req });
      return renderLogin(res, { error: 'That email and password do not match.', email, status: 401 });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate(err => (err ? reject(err) : resolve()));
    });
    req.session.companyUserId = user.id;
    req.session.csrfToken = randomString(32);

    await db.query('UPDATE company_users SET last_login_at = now() WHERE id = $1', [user.id]);
    await audit({ actor: user.email, action: 'company.login', req });
    return res.redirect('/company');
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireCsrf, (req, res) => {
  req.session.destroy(() => res.redirect('/company/login'));
});

router.get('/', requireCompany, async (req, res, next) => {
  try {
    const projects = await service.getDashboard();
    const stats = {
      inTest: projects.filter(p => ['in-progress', 'not-started'].includes(p.status)).length,
      toFix: projects.reduce((n, p) => n + p.fail, 0),
      waiting: projects.filter(p => p.status === 'ready').length,
      signed: projects.filter(p => p.status === 'signed').length
    };
    res.render('company/dashboard', {
      title: 'UAT projects',
      side: 'company',
      projects,
      stats
    });
  } catch (err) {
    next(err);
  }
});

router.get('/projects/new', requireCompany, async (req, res, next) => {
  try {
    const products = (await db.query('SELECT id, name FROM products ORDER BY name')).rows;
    const clients = (await db.query('SELECT id, name FROM clients ORDER BY name')).rows;
    res.render('company/new-project', {
      title: 'New UAT project',
      side: 'company',
      products,
      clients,
      values: {
        productMode: products.length ? 'existing' : 'new',
        productId: products[0] ? products[0].id : '',
        newProduct: '',
        clientMode: clients.length ? 'existing' : 'new',
        clientId: clients[0] ? clients[0].id : '',
        newClient: '',
        version: 'v1.0',
        ownerName: req.companyUser.name,
        ownerEmail: req.companyUser.email,
        expiry: isoDate(Date.now() + 30 * 86400000)
      },
      errors: [],
      checklistErrors: [],
      fileName: '',
      preview: null
    });
  } catch (err) {
    next(err);
  }
});

// Validate an uploaded checklist without creating anything. Used by the
// new-project page to show immediate feedback as soon as a file is chosen.
router.post('/projects/preview', requireCompany, upload.single('checklist'), requireCsrf, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, errors: ['Choose an .xlsx or .csv checklist first.'] });
    }
    const parsed = await parseChecklist(req.file.buffer, req.file.originalname);
    if (parsed.errors.length) {
      return res.json({
        ok: false,
        fileName: req.file.originalname,
        errors: parsed.errors
      });
    }
    const milestones = rowsToMilestones(parsed.rows).map(m => ({
      name: m.name,
      count: m.items.length,
      required: m.items.filter(i => i.mandatory).length
    }));
    return res.json({
      ok: true,
      fileName: req.file.originalname,
      total: parsed.rows.length,
      milestones
    });
  } catch (err) {
    next(err);
  }
});

router.post('/projects', requireCompany, upload.single('checklist'), requireCsrf, async (req, res, next) => {
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

    const products = (await db.query('SELECT id, name FROM products ORDER BY name')).rows;
    const clients = (await db.query('SELECT id, name FROM clients ORDER BY name')).rows;
    const errors = [];

    if (values.productMode === 'new') {
      if (!values.newProduct) errors.push('Enter a name for the new product.');
    } else {
      const exists = await db.query('SELECT 1 FROM products WHERE id = $1', [values.productId]);
      if (!exists.rows.length) errors.push('Choose a product, or add a new one.');
    }

    if (values.clientMode === 'new') {
      if (!values.newClient) errors.push('Enter a name for the new client.');
    } else {
      const exists = await db.query('SELECT 1 FROM clients WHERE id = $1', [values.clientId]);
      if (!exists.rows.length) errors.push('Choose a client, or add a new one.');
    }

    if (!values.version) errors.push('Enter a release or version, such as v1.0.');
    if (!values.ownerName) errors.push('Enter the company contact’s name.');
    if (values.ownerEmail && !isValidEmail(values.ownerEmail)) errors.push('Enter a valid company contact email, or leave it blank.');
    if (!values.expiry) errors.push('Choose how long the link stays available.');
    else if (values.expiry < isoDate(Date.now())) errors.push('The link’s end date is in the past.');
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
      return res.status(400).render('company/new-project', {
        title: 'New UAT project',
        side: 'company',
        products,
        clients,
        values,
        errors,
        checklistErrors: parsed.errors,
        fileName: req.file ? req.file.originalname : '',
        preview: parsed.rows.length ? rowsToMilestones(parsed.rows).map(m => ({
          name: m.name,
          count: m.items.length,
          required: m.items.filter(i => i.mandatory).length
        })) : null
      });
    }

    const product = values.productMode === 'new'
      ? await service.findOrCreateProduct(values.newProduct)
      : { id: values.productId };
    const client = values.clientMode === 'new'
      ? await service.findOrCreateClient(values.newClient)
      : { id: values.clientId };

    let token;
    for (let i = 0; i < 30; i += 1) {
      const candidate = generateProjectId();
      const taken = await db.query('SELECT 1 FROM access_links WHERE upper(token) = upper($1)', [candidate]);
      if (!taken.rows.length) { token = candidate; break; }
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

    const checklistKey = `projects/${projectId}/checklist/${Date.now()}-${safeFilename(req.file.originalname)}`;
    await storage.put(checklistKey, req.file.buffer, req.file.mimetype || 'application/octet-stream');
    await db.query('UPDATE projects SET checklist_key = $2 WHERE id = $1', [projectId, checklistKey]);

    await audit({
      projectId,
      actor: req.companyUser.email,
      action: 'project.created',
      detail: `${token} · ${parsed.rows.length} items`,
      req
    });

    req.session.newPassword = { projectId, password };
    flash(req, 'ok', 'Project created. Copy the password now — it is shown once and stored only as a hash.');
    return res.redirect(`/company/projects/${projectId}`);
  } catch (err) {
    return next(err);
  }
});

router.get('/template.csv', requireCompany, (req, res) => {
  const header = COLS.map(c => c[1]);
  const csv = [header, ...TEMPLATE_ROWS].map(row => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="uat-checklist-template.csv"');
  res.send(`\uFEFF${csv}`);
});

router.get('/template.xlsx', requireCompany, async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('UAT checklist');
    sheet.addRow(COLS.map(c => c[1]));
    TEMPLATE_ROWS.forEach(row => sheet.addRow(row));
    sheet.columns = [
      { width: 16 }, { width: 24 }, { width: 10 }, { width: 34 },
      { width: 50 }, { width: 50 }, { width: 16 }, { width: 22 }
    ];
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="uat-checklist-template.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

router.get('/projects/:id', requireCompany, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) return next();
    const events = await service.getAudit(bundle.project.id, 50);
    const created = req.session.newPassword && req.session.newPassword.projectId === bundle.project.id
      ? req.session.newPassword
      : null;
    delete req.session.newPassword;

    return res.render('company/project', {
      title: `${bundle.product.name} ${bundle.project.version}`,
      side: 'company',
      bundle,
      events,
      newPassword: created ? created.password : null,
      invite: created ? inviteText(bundle, created.password) : null
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/projects/:id/password', requireCompany, requireCsrf, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) return next();
    const password = generateClientPassword();
    await service.rotatePassword(bundle.project.id, scryptHash(password));
    await audit({
      projectId: bundle.project.id,
      actor: req.companyUser.email,
      action: 'access.password_rotated',
      detail: 'Client password replaced',
      req
    });
    req.session.newPassword = { projectId: bundle.project.id, password };
    flash(req, 'ok', 'New password generated. Copy it now — it is shown once.');
    return res.redirect(`/company/projects/${bundle.project.id}`);
  } catch (err) {
    return next(err);
  }
});

router.post('/projects/:id/expiry', requireCompany, requireCsrf, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) return next();
    const date = String(req.body.expiry || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < isoDate(Date.now())) {
      flash(req, 'error', 'Choose an end date today or later.');
      return res.redirect(`/company/projects/${bundle.project.id}`);
    }
    await service.setExpiry(bundle.project.id, date);
    await audit({
      projectId: bundle.project.id,
      actor: req.companyUser.email,
      action: 'access.expiry_changed',
      detail: `Available until ${date}`,
      req
    });
    flash(req, 'ok', 'End date updated.');
    return res.redirect(`/company/projects/${bundle.project.id}`);
  } catch (err) {
    return next(err);
  }
});

router.post('/projects/:id/revoke', requireCompany, requireCsrf, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) return next();
    const revoke = !bundle.link.revoked_at;
    await service.setRevoked(bundle.project.id, revoke);
    await audit({
      projectId: bundle.project.id,
      actor: req.companyUser.email,
      action: revoke ? 'access.revoked' : 'access.restored',
      req
    });
    flash(req, 'ok', revoke ? 'Client access is now turned off.' : 'Client access is back on.');
    return res.redirect(`/company/projects/${bundle.project.id}`);
  } catch (err) {
    return next(err);
  }
});

router.post('/projects/:id/items/:itemId/fix', requireCompany, requireCsrf, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) return next();
    const item = bundle.milestones.flatMap(m => m.items).find(i => i.id === req.params.itemId);
    if (!item) return next();
    if (item.status !== 'fail') {
      flash(req, 'error', 'Only a failed item can be sent for retest.');
      return res.redirect(`/company/projects/${bundle.project.id}`);
    }
    const note = String(req.body.fixNote || '').trim();
    if (note.length < 3) {
      flash(req, 'error', 'Add a short note describing what was fixed.');
      return res.redirect(`/company/projects/${bundle.project.id}`);
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
    flash(req, 'ok', `${item.code} sent to the client for retest.`);
    return res.redirect(`/company/projects/${bundle.project.id}`);
  } catch (err) {
    return next(err);
  }
});

router.get('/projects/:id/items/:itemId/screenshot', requireCompany, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle) return next();
    const item = bundle.milestones.flatMap(m => m.items).find(i => i.id === req.params.itemId);
    if (!item || !item.image_key) return next();
    const ext = item.image_key.split('.').pop().toLowerCase();
    const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    return storage.sendFile(res, item.image_key, { contentType: types[ext] || 'application/octet-stream' });
  } catch (err) {
    return next(err);
  }
});

router.get('/projects/:id/signature', requireCompany, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle || !bundle.signoff || !bundle.signoff.signature_key) return next();
    return storage.sendFile(res, bundle.signoff.signature_key, { contentType: 'image/png' });
  } catch (err) {
    return next(err);
  }
});

router.get('/projects/:id/certificate.pdf', requireCompany, async (req, res, next) => {
  try {
    const bundle = await service.getProjectBundle(req.params.id);
    if (!bundle || !bundle.signoff || !bundle.signoff.pdf_key) return next();
    const filename = `UAT-certificate-${bundle.client.name}-${bundle.product.name}-${bundle.project.version}-${bundle.signoff.verification_id}.pdf`
      .replace(/[^\w.\-]+/g, '-');
    await audit({
      projectId: bundle.project.id,
      actor: req.companyUser.email,
      action: 'certificate.downloaded',
      req
    });
    return storage.sendFile(res, bundle.signoff.pdf_key, { contentType: 'application/pdf', filename });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
