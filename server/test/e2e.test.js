const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const request = require('supertest');

const { createApp } = require('../src/app');
const db = require('../src/db');
const config = require('../src/config');
const { scryptHash, uuid } = require('../src/security');
const { COLS, TEMPLATE_ROWS } = require('../src/checklist');

const app = createApp();
const serverRoot = path.join(__dirname, '..');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

let projectId = null;
let token = null;
let clientPassword = null;

function csrfFrom(html) {
  const match = /name="_csrf" value="([^"]+)"/.exec(html);
  if (!match) throw new Error('CSRF token not found in page');
  return match[1];
}

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function csvCell(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

before(async () => {
  execFileSync(process.execPath, ['src/migrate.js'], { cwd: serverRoot, stdio: 'ignore' });
  const existing = await db.query('SELECT id FROM company_users WHERE lower(email) = lower($1)', [config.adminEmail]);
  if (existing.rows.length) {
    await db.query('UPDATE company_users SET password_hash = $2 WHERE id = $1', [
      existing.rows[0].id, scryptHash(config.adminPassword)
    ]);
  } else {
    await db.query(
      'INSERT INTO company_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
      [uuid(), config.adminEmail, 'E2E Admin', scryptHash(config.adminPassword)]
    );
  }
});

after(async () => {
  if (projectId) {
    await db.query('DELETE FROM audit_log WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await fs.rm(path.join(config.storageDir, 'projects', projectId), { recursive: true, force: true });
  }
  await db.pool.end();
});

test('company creates a project and client signs off end to end', async () => {
  const company = request.agent(app);

  let res = await company.get('/company/login');
  assert.equal(res.status, 200);
  let csrf = csrfFrom(res.text);

  res = await company
    .post('/company/login')
    .type('form')
    .send({ _csrf: csrf, email: config.adminEmail, password: config.adminPassword });
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/company');

  res = await company.get('/company/projects/new');
  assert.equal(res.status, 200);
  csrf = csrfFrom(res.text);

  const csv = [COLS.map(c => c[1]), ...TEMPLATE_ROWS]
    .map(row => row.map(csvCell).join(','))
    .join('\n');

  res = await company
    .post('/company/projects')
    .field('_csrf', csrf)
    .field('productMode', 'new')
    .field('newProduct', `E2E Product ${Date.now()}`)
    .field('version', 'v9.9')
    .field('clientMode', 'new')
    .field('newClient', `E2E Client ${Date.now()}`)
    .field('ownerName', 'E2E Owner')
    .field('ownerEmail', 'owner-e2e@example.com')
    .field('expiry', new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
    .attach('checklist', Buffer.from(csv), 'checklist.csv');

  assert.equal(res.status, 302);
  assert.match(res.headers.location, /^\/company\/projects\/[0-9a-f-]{36}$/);
  projectId = res.headers.location.split('/').pop();

  const projectRes = await company.get(`/company/projects/${projectId}`);
  assert.equal(projectRes.status, 200);
  assert.match(projectRes.text, /Client credentials/);
  const passwordMatch = /id="project-password"[^>]*value="([^"]+)"/.exec(projectRes.text);
  assert.ok(passwordMatch, 'generated client password should be shown once');
  clientPassword = passwordMatch[1];

  const link = await db.query('SELECT token FROM access_links WHERE project_id = $1', [projectId]);
  token = link.rows[0].token;
  assert.match(token, /^UAT-[A-Z0-9]{6}$/);

  // Client side -------------------------------------------------------------
  const client = request.agent(app);
  res = await client.get(`/p/${token}`);
  assert.equal(res.status, 200);
  csrf = csrfFrom(res.text);

  res = await client
    .post(`/p/${token}`)
    .type('form')
    .send({ _csrf: csrf, password: clientPassword });
  assert.equal(res.status, 302);

  res = await client.get(`/p/${token}/tester`);
  assert.equal(res.status, 200);
  csrf = csrfFrom(res.text);

  res = await client
    .post(`/p/${token}/tester`)
    .type('form')
    .send({ _csrf: csrf, name: 'E2E Tester', email: 'tester-e2e@example.com' });
  assert.equal(res.status, 302);

  res = await client.get(`/p/${token}/portal`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Milestone/);
  csrf = csrfFrom(res.text);

  const items = (await db.query(
    'SELECT id, code, evidence, mandatory FROM checklist_items WHERE project_id = $1 ORDER BY position',
    [projectId]
  )).rows;
  assert.ok(items.length >= 7);

  // Fail the first item, let the company mark it fixed, then retest it. This
  // exercises the retest loop before the rest of the checklist is completed.
  const firstItem = items[0];
  res = await client
    .post(`/p/${token}/items/${firstItem.id}/result`)
    .type('form')
    .send({ _csrf: csrf, status: 'fail', comment: 'E2E failure: the total did not update.' });
  assert.equal(res.status, 302);

  res = await company.get(`/company/projects/${projectId}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Mark fixed/);
  const companyCsrf = csrfFrom(res.text);

  res = await company
    .post(`/company/projects/${projectId}/items/${firstItem.id}/fix`)
    .type('form')
    .send({ _csrf: companyCsrf, fixNote: 'Corrected in build 9.9.1.' });
  assert.equal(res.status, 302);

  res = await client.get(`/p/${token}/portal`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Ready for retest/);

  res = await client
    .post(`/p/${token}/items/${firstItem.id}/result`)
    .type('form')
    .send({ _csrf: csrf, status: 'pass', comment: 'Retested and passed.' });
  assert.equal(res.status, 302);

  for (const item of items.slice(1)) {
    if (item.evidence) {
      res = await client
        .post(`/p/${token}/items/${item.id}/screenshot`)
        .field('_csrf', csrf)
        .attach('screenshot', png, { filename: 'evidence.png', contentType: 'image/png' });
      assert.equal(res.status, 302, `screenshot upload for ${item.code}`);
    }

    res = await client
      .post(`/p/${token}/items/${item.id}/result`)
      .type('form')
      .send({ _csrf: csrf, status: 'pass', comment: `E2E pass for ${item.code}` });
    assert.equal(res.status, 302, `result for ${item.code}`);
  }

  res = await client.get(`/p/${token}/portal`);
  assert.equal(res.status, 200);
  assert.match(res.text, /All milestones are complete/);

  // Sign-off ----------------------------------------------------------------
  res = await client.get(`/p/${token}/signoff`);
  assert.equal(res.status, 200);
  csrf = csrfFrom(res.text);

  res = await client
    .post(`/p/${token}/signoff/start`)
    .type('form')
    .send({
      _csrf: csrf,
      name: 'E2E Signer',
      designation: 'Director of Operations',
      email: 'signer-e2e@example.com'
    });
  assert.equal(res.status, 302);

  const outbox = await db.query(
    'SELECT body FROM dev_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1',
    ['signer-e2e@example.com']
  );
  assert.equal(outbox.rows.length, 1, 'OTP email should be written to the dev outbox');
  const codeMatch = /\b(\d{6})\b/.exec(outbox.rows[0].body);
  assert.ok(codeMatch, 'OTP code should be in the email body');

  res = await client
    .post(`/p/${token}/signoff/verify`)
    .type('form')
    .send({ _csrf: csrf, code: codeMatch[1] });
  assert.equal(res.status, 302);

  res = await client.get(`/p/${token}/signoff`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Your signature/);
  csrf = csrfFrom(res.text);

  res = await client
    .post(`/p/${token}/signoff/submit`)
    .type('form')
    .send({
      _csrf: csrf,
      signatureKind: 'drawn',
      signature: `data:image/png;base64,${png.toString('base64')}`,
      consent: 'on'
    });
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, `/p/${token}/certificate`);

  res = await client.get(`/p/${token}/certificate`);
  assert.equal(res.status, 200);
  assert.match(res.text, /UAT Completion Certificate/);

  const pdfRes = await client
    .get(`/p/${token}/certificate.pdf`)
    .buffer(true)
    .parse(binaryParser);
  assert.equal(pdfRes.status, 200);
  assert.match(pdfRes.headers['content-type'], /application\/pdf/);
  assert.equal(pdfRes.body.slice(0, 5).toString(), '%PDF-');

  const signoff = (await db.query('SELECT * FROM signoffs WHERE project_id = $1', [projectId])).rows[0];
  assert.ok(signoff);
  assert.match(signoff.verification_id, /^VC-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.match(signoff.record_hash, /^[0-9a-f]{64}$/);
  assert.match(signoff.pdf_hash, /^[0-9a-f]{64}$/);
  assert.equal(signoff.signer_email, 'signer-e2e@example.com');
  assert.ok(signoff.signature_key, 'drawn signature should be stored');

  // Public verification -----------------------------------------------------
  const publicAgent = request.agent(app);
  res = await publicAgent.get(`/verify?id=${signoff.verification_id}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Valid certificate/);
  assert.match(res.text, new RegExp(signoff.verification_id));

  res = await publicAgent.post('/verify').type('form').send({
    _csrf: csrfFrom(res.text),
    verificationId: signoff.verification_id.toLowerCase()
  });
  assert.equal(res.status, 200);
  assert.match(res.text, /Valid certificate/);

  res = await publicAgent.get(`/verify?id=${signoff.verification_id}`);
  const verifyCsrf = csrfFrom(res.text);
  res = await publicAgent
    .post('/verify/pdf')
    .field('_csrf', verifyCsrf)
    .field('verificationId', signoff.verification_id)
    .attach('pdf', pdfRes.body, { filename: 'certificate.pdf', contentType: 'application/pdf' });
  assert.equal(res.status, 200);
  assert.match(res.text, /PDF matches/);
});
