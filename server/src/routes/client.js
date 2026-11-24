const express = require('express');
const multer = require('multer');

const db = require('../db');
const service = require('../projectService');
const storage = require('../storage');
const { audit } = require('../audit');
const {
  requireCsrf, flash, loadClientProject, requireClientAuth, requireClientSession, requireTester, accessBlocked
} = require('../auth');
const { clientLogin: clientLoginLimiter, otp: otpLimiter } = require('../rateLimiters');
const {
  scryptVerify, generateOtp, hashOtp, verifyOtpHash, uuid, generateVerificationId,
  sha256Hex, canonicalJson, decodeImageDataUrl, imageKindFromBuffer, isValidEmail
} = require('../security');
const { buildCertificatePDF } = require('../pdf');
const { sendOtpEmail, sendCertificateEmail } = require('../email');
const config = require('../config');

const router = express.Router({ mergeParams: true });
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 4);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 }
});

router.use(loadClientProject);

const tokenOf = req => req.bundle.link.token;
const certPath = req => `/p/${tokenOf(req)}/certificate`;
const portalPath = req => `/p/${tokenOf(req)}/portal`;
const signoffPath = req => `/p/${tokenOf(req)}/signoff`;

function allComplete(bundle) {
  return bundle.stats.total > 0 && bundle.stats.done === bundle.stats.total;
}

router.get('/', (req, res) => {
  if (req.bundle.signoff) return res.redirect(certPath(req));
  if (req.clientAuthed) {
    return res.redirect(req.tester ? portalPath(req) : `/p/${tokenOf(req)}/tester`);
  }
  const blocked = accessBlocked(req.bundle);
  if (blocked) {
    return res.status(403).render('client/closed', {
      title: blocked === 'revoked' ? 'Access turned off' : 'Link expired',
      side: 'client',
      reason: blocked
    });
  }
  return res.render('client/login', {
    title: 'Open your UAT checklist',
    side: 'client',
    error: null
  });
});

router.post('/', clientLoginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const bundle = req.bundle;
    if (bundle.signoff) return res.redirect(certPath(req));
    const blocked = accessBlocked(bundle);
    if (blocked) {
      return res.status(403).render('client/closed', {
        title: blocked === 'revoked' ? 'Access turned off' : 'Link expired',
        side: 'client',
        reason: blocked
      });
    }

    const { rows } = await db.query(
      'SELECT id, password_hash, locked_until FROM access_links WHERE project_id = $1',
      [bundle.project.id]
    );
    const link = rows[0];
    if (!link) return next();

    if (link.locked_until && new Date(link.locked_until).getTime() > Date.now()) {
      const minutes = Math.ceil((new Date(link.locked_until).getTime() - Date.now()) / 60000);
      return res.status(429).render('client/login', {
        title: 'Open your UAT checklist',
        side: 'client',
        error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
      });
    }

    const password = String(req.body.password || '');
    if (!scryptVerify(password, link.password_hash)) {
      await service.recordAccessFailure(link.id);
      await audit({
        projectId: bundle.project.id,
        actor: 'unknown visitor',
        action: 'client.login_failed',
        req
      });
      return res.status(401).render('client/login', {
        title: 'Open your UAT checklist',
        side: 'client',
        error: 'That password does not match. Check the invitation email.'
      });
    }

    await service.clearAccessFailures(link.id);
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => (err ? reject(err) : resolve()));
    });
    req.session.client = { projectId: bundle.project.id, token: bundle.link.token };
    await audit({ projectId: bundle.project.id, actor: 'client', action: 'client.login', req });
    return res.redirect(`/p/${tokenOf(req)}/tester`);
  } catch (err) {
    return next(err);
  }
});

router.get('/tester', requireClientAuth, (req, res) => {
  res.render('client/tester', {
    title: 'Who is testing?',
    side: 'client',
    tester: req.tester || null,
    error: null
  });
});

router.post('/tester', requireClientAuth, requireCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!name || !isValidEmail(email)) {
      return res.status(400).render('client/tester', {
        title: 'Who is testing?',
        side: 'client',
        tester: { name, email },
        error: 'Enter your name and a valid work email.'
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
    return res.redirect(portalPath(req));
  } catch (err) {
    return next(err);
  }
});

router.get('/portal', requireClientAuth, requireTester, (req, res) => {
  const bundle = req.bundle;
  if (bundle.signoff) return res.redirect(certPath(req));

  let index = bundle.milestones.findIndex(m => m.id === req.query.ms);
  if (index < 0) index = bundle.currentIndex < 0 ? bundle.milestones.length - 1 : bundle.currentIndex;
  if (bundle.states[index] === 'locked') index = bundle.currentIndex;

  res.render('client/portal', {
    title: 'Acceptance testing',
    side: 'client',
    bundle,
    index,
    milestone: bundle.milestones[index],
    state: bundle.states[index],
    allDone: allComplete(bundle)
  });
});

router.post('/items/:itemId/result', requireClientAuth, requireTester, requireCsrf, async (req, res, next) => {
  const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
  try {
    const bundle = req.bundle;
    if (bundle.signoff) {
      if (isAjax) return res.status(400).json({ ok: false, error: 'Project has already been signed off.' });
      return res.redirect(certPath(req));
    }

    const item = bundle.milestones.flatMap(m => m.items).find(i => i.id === req.params.itemId);
    if (!item) {
      if (isAjax) return res.status(404).json({ ok: false, error: 'Checklist item not found.' });
      return next();
    }

    const mi = bundle.milestones.findIndex(m => m.items.some(i => i.id === item.id));
    const milestone = bundle.milestones[mi];
    const back = `${portalPath(req)}?ms=${milestone.id}#item-${item.id}`;

    if (bundle.states[mi] === 'locked') {
      if (isAjax) return res.status(400).json({ ok: false, error: 'Finish the earlier milestone first.' });
      flash(req, 'error', 'Finish the earlier milestone first.');
      return res.redirect(portalPath(req));
    }

    const status = String(req.body.status || '');
    const comment = String(req.body.comment || '').trim();

    if (!['pass', 'fail', 'na'].includes(status)) {
      if (isAjax) return res.status(400).json({ ok: false, error: 'Choose Pass, Fail or Not applicable.' });
      flash(req, 'error', 'Choose Pass, Fail or Not applicable.');
      return res.redirect(back);
    }
    if (status === 'fail' && !comment) {
      if (isAjax) return res.status(400).json({ ok: false, error: `Describe what went wrong for ${item.code} before marking it failed.` });
      flash(req, 'error', `Describe what went wrong for ${item.code} before marking it failed.`);
      return res.redirect(back);
    }
    if (status === 'na' && item.mandatory) {
      if (isAjax) return res.status(400).json({ ok: false, error: `${item.code} is required and cannot be marked not applicable.` });
      flash(req, 'error', `${item.code} is required and cannot be marked not applicable.`);
      return res.redirect(back);
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
    const freshMilestone = fresh.milestones.find(m => m.id === milestone.id);
    const msComplete = service.milestoneComplete(freshMilestone);
    const allDone = allComplete(fresh);

    if (isAjax) {
      return res.json({
        ok: true,
        status,
        code: item.code,
        milestoneComplete: msComplete,
        allDone,
        stats: fresh.stats
      });
    }

    if (msComplete) {
      flash(req, 'ok', `Milestone complete: ${freshMilestone.name}.`);
    } else {
      flash(req, 'ok', `${item.code} marked ${status === 'na' ? 'not applicable' : status}.`);
    }
    return res.redirect(back);
  } catch (err) {
    if (isAjax) {
      return res.status(500).json({ ok: false, error: 'Failed to save result.' });
    }
    return next(err);
  }
});

router.post('/items/:itemId/screenshot', requireClientAuth, requireTester, upload.single('screenshot'), requireCsrf, async (req, res, next) => {
  try {
    const bundle = req.bundle;
    if (bundle.signoff) return res.redirect(certPath(req));

    const item = bundle.milestones.flatMap(m => m.items).find(i => i.id === req.params.itemId);
    if (!item) return next();
    const mi = bundle.milestones.findIndex(m => m.items.some(i => i.id === item.id));
    const milestone = bundle.milestones[mi];
    const back = `${portalPath(req)}?ms=${milestone.id}#item-${item.id}`;

    if (bundle.states[mi] === 'locked') {
      flash(req, 'error', 'Finish the earlier milestone first.');
      return res.redirect(portalPath(req));
    }
    if (!req.file) {
      flash(req, 'error', 'Choose a PNG or JPG screenshot.');
      return res.redirect(back);
    }
    const kind = imageKindFromBuffer(req.file.buffer);
    if (!kind || kind === 'webp') {
      flash(req, 'error', 'Attach a PNG or JPG image.');
      return res.redirect(back);
    }

    const key = `projects/${bundle.project.id}/screenshots/${uuid()}.${kind === 'jpeg' ? 'jpg' : kind}`;
    await storage.put(key, req.file.buffer, kind === 'jpeg' ? 'image/jpeg' : 'image/png');
    await db.query('UPDATE checklist_items SET image_key = $2 WHERE id = $1 AND project_id = $3', [
      item.id, key, bundle.project.id
    ]);
    await audit({
      projectId: bundle.project.id,
      actor: req.tester.name,
      action: 'item.screenshot',
      detail: item.code,
      req
    });
    flash(req, 'ok', `Screenshot attached to ${item.code}.`);
    return res.redirect(back);
  } catch (err) {
    return next(err);
  }
});

router.get('/items/:itemId/screenshot', requireClientAuth, async (req, res, next) => {
  try {
    const item = req.bundle.milestones.flatMap(m => m.items).find(i => i.id === req.params.itemId);
    if (!item || !item.image_key) return next();
    const ext = item.image_key.split('.').pop().toLowerCase();
    const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    return storage.sendFile(res, item.image_key, { contentType: types[ext] || 'application/octet-stream' });
  } catch (err) {
    return next(err);
  }
});

router.get('/signoff', requireClientAuth, requireTester, async (req, res, next) => {
  try {
    const bundle = req.bundle;
    if (bundle.signoff) return res.redirect(certPath(req));
    if (req.query.restart === '1') {
      delete req.session.signoff;
      return res.redirect(signoffPath(req));
    }
    if (!allComplete(bundle)) {
      flash(req, 'error', 'Every milestone must be complete before sign-off.');
      return res.redirect(portalPath(req));
    }

    const state = req.session.signoff || null;
    let step = 1;
    let devCode = null;

    if (state && state.verifiedAt) {
      step = 3;
    } else if (state && state.challengeId) {
      step = 2;
      if (!config.isProd) {
        const { rows } = await db.query(
          'SELECT body FROM dev_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1',
          [state.email]
        );
        if (rows.length) {
          const match = /\b(\d{6})\b/.exec(rows[0].body);
          if (match) devCode = match[1];
        }
      }
    }

    return res.render('client/signoff', {
      title: 'Sign off',
      side: 'client',
      bundle,
      step,
      state,
      devCode
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/signoff/start', requireClientAuth, requireTester, otpLimiter, requireCsrf, async (req, res, next) => {
  try {
    const bundle = req.bundle;
    if (bundle.signoff) return res.redirect(certPath(req));
    if (!allComplete(bundle)) {
      flash(req, 'error', 'Every milestone must be complete before sign-off.');
      return res.redirect(portalPath(req));
    }

    const name = String(req.body.name || '').trim();
    const designation = String(req.body.designation || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!name || !designation || !isValidEmail(email)) {
      req.session.signoff = { name, designation, email };
      flash(req, 'error', 'Enter the signer’s full name, designation and a valid work email.');
      return res.redirect(signoffPath(req));
    }

    const code = generateOtp();
    const challengeId = uuid();
    // A new code invalidates any older unverified code for this signer.
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
    flash(req, 'ok', `A one-time code was sent to ${email}.`);
    return res.redirect(signoffPath(req));
  } catch (err) {
    return next(err);
  }
});

router.post('/signoff/verify', requireClientAuth, requireTester, otpLimiter, requireCsrf, async (req, res, next) => {
  try {
    const state = req.session.signoff;
    if (!state || !state.challengeId) {
      flash(req, 'error', 'Start the sign-off again to get a new code.');
      return res.redirect(signoffPath(req));
    }

    const { rows } = await db.query(
      'SELECT * FROM otp_challenges WHERE id = $1 AND project_id = $2',
      [state.challengeId, req.bundle.project.id]
    );
    const challenge = rows[0];
    if (!challenge) {
      delete req.session.signoff;
      flash(req, 'error', 'That code has expired. Start the sign-off again.');
      return res.redirect(signoffPath(req));
    }
    if (challenge.verified_at) {
      state.verifiedAt = new Date(challenge.verified_at).toISOString();
      return res.redirect(signoffPath(req));
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      flash(req, 'error', 'That code has expired. Send a new one.');
      return res.redirect(signoffPath(req));
    }
    if (challenge.attempts >= 5) {
      flash(req, 'error', 'Too many incorrect codes. Send a new one.');
      return res.redirect(signoffPath(req));
    }

    const code = String(req.body.code || '').trim();
    if (!verifyOtpHash(code, challenge.code_hash)) {
      await db.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
      await audit({
        projectId: req.bundle.project.id,
        actor: state.name,
        action: 'signoff.otp_failed',
        req
      });
      flash(req, 'error', 'That code does not match. Check the email or send a new code.');
      return res.redirect(signoffPath(req));
    }

    await db.query('UPDATE otp_challenges SET verified_at = now() WHERE id = $1', [challenge.id]);
    state.verifiedAt = new Date().toISOString();
    await audit({
      projectId: req.bundle.project.id,
      actor: state.name,
      action: 'signoff.otp_verified',
      detail: state.email,
      req
    });
    return res.redirect(signoffPath(req));
  } catch (err) {
    return next(err);
  }
});

router.post('/signoff/submit', requireClientAuth, requireTester, otpLimiter, requireCsrf, async (req, res, next) => {
  try {
    const bundle = req.bundle;
    if (bundle.signoff) return res.redirect(certPath(req));

    const state = req.session.signoff;
    if (!state || !state.verifiedAt || !state.challengeId) {
      flash(req, 'error', 'Verify your email before signing.');
      return res.redirect(signoffPath(req));
    }

    const { rows: challengeRows } = await db.query(
      'SELECT verified_at FROM otp_challenges WHERE id = $1 AND project_id = $2',
      [state.challengeId, bundle.project.id]
    );
    if (!challengeRows.length || !challengeRows[0].verified_at) {
      flash(req, 'error', 'Verify your email before signing.');
      return res.redirect(signoffPath(req));
    }
    if (!allComplete(bundle)) {
      flash(req, 'error', 'Every milestone must be complete before sign-off.');
      return res.redirect(portalPath(req));
    }
    if (req.body.consent !== 'on') {
      flash(req, 'error', 'Tick the confirmation box to sign.');
      return res.redirect(signoffPath(req));
    }

    const kind = req.body.signatureKind === 'typed' ? 'typed' : 'drawn';
    let signatureBuffer = null;
    if (kind === 'drawn') {
      const decoded = decodeImageDataUrl(req.body.signature, ['png', 'jpeg']);
      if (!decoded) {
        flash(req, 'error', 'Draw your signature in the box.');
        return res.redirect(signoffPath(req));
      }
      signatureBuffer = decoded.buffer;
    } else {
      const typed = String(req.body.signatureName || state.name).trim();
      if (!typed) {
        flash(req, 'error', 'Type your full name to sign.');
        return res.redirect(signoffPath(req));
      }
    }

    const signedAt = new Date();
    const otpVerifiedAt = new Date(challengeRows[0].verified_at);

    let verificationId;
    for (let i = 0; i < 30; i += 1) {
      const candidate = generateVerificationId();
      const taken = await db.query('SELECT 1 FROM signoffs WHERE verification_id = $1', [candidate]);
      if (!taken.rows.length) { verificationId = candidate; break; }
    }
    if (!verificationId) throw new Error('Could not allocate a verification ID');

    const summary = bundle.milestones.map(m => ({
      name: m.name,
      total: m.items.length,
      pass: m.items.filter(i => i.status === 'pass').length,
      na: m.items.filter(i => i.status === 'na').length,
      completedAt: m.items.reduce((max, it) => Math.max(max, it.tested_at ? new Date(it.tested_at).getTime() : 0), 0)
    }));

    const record = {
      projectId: bundle.link.token,
      product: bundle.product.name,
      version: bundle.project.version,
      client: bundle.client.name,
      owner: bundle.project.owner_name,
      milestones: bundle.milestones.map(m => ({
        name: m.name,
        items: m.items.map(it => ({
          code: it.code,
          status: it.status,
          comment: it.comment || '',
          tester: it.tester_name || null,
          testedAt: it.tested_at ? new Date(it.tested_at).toISOString() : null
        }))
      })),
      signer: { name: state.name, designation: state.designation, email: state.email },
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
          signoffId, bundle.project.id, verificationId, state.name, state.designation, state.email,
          otpVerifiedAt, kind, signedAt, req.ip, req.get('user-agent'),
          JSON.stringify(record), recordHash, JSON.stringify(summary)
        ]
      );
    } catch (err) {
      if (err.code === '23505') {
        flash(req, 'error', 'This project is already signed off.');
        return res.redirect(certPath(req));
      }
      throw err;
    }

    if (signatureBuffer) {
      const key = `projects/${bundle.project.id}/signatures/${signoffId}.png`;
      await storage.put(key, signatureBuffer, 'image/png');
      await db.query('UPDATE signoffs SET signature_key = $2 WHERE id = $1', [signoffId, key]);
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
    await db.query('UPDATE signoffs SET pdf_key = $2, pdf_hash = $3 WHERE id = $1', [signoffId, pdfKey, pdfHash]);

    const verifyUrl = `${config.appBaseUrl}/verify?id=${encodeURIComponent(verificationId)}`;
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
    flash(req, 'ok', 'Signed off. The completion certificate is ready.');
    return res.redirect(certPath(req));
  } catch (err) {
    return next(err);
  }
});

router.get('/certificate', requireClientSession, (req, res) => {
  if (!req.bundle.signoff) return res.redirect(portalPath(req));
  const so = req.bundle.signoff;
  res.render('client/certificate', {
    title: 'Completion certificate',
    side: 'client',
    bundle: req.bundle,
    signatureUrl: so.signature_key ? `/p/${tokenOf(req)}/signature` : null,
    verifyUrl: `${config.appBaseUrl}/verify?id=${encodeURIComponent(so.verification_id)}`
  });
});

router.get('/certificate.pdf', requireClientSession, async (req, res, next) => {
  try {
    const so = req.bundle.signoff;
    if (!so || !so.pdf_key) return next();
    const filename = `UAT-certificate-${req.bundle.client.name}-${req.bundle.product.name}-${req.bundle.project.version}-${so.verification_id}.pdf`
      .replace(/[^\w.\-]+/g, '-');
    return storage.sendFile(res, so.pdf_key, { contentType: 'application/pdf', filename });
  } catch (err) {
    return next(err);
  }
});

router.get('/signature', requireClientSession, async (req, res, next) => {
  try {
    const so = req.bundle.signoff;
    if (!so || !so.signature_key) return next();
    return storage.sendFile(res, so.signature_key, { contentType: 'image/png' });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireCsrf, (req, res) => {
  const token = req.bundle.link.token;
  req.session.destroy(() => res.redirect(`/p/${token}`));
});

module.exports = router;
