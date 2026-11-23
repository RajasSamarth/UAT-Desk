const db = require('./db');
const config = require('./config');
const { uuid, scryptHash } = require('./security');
const service = require('./projectService');
const { INV_ROWS, FS_ROWS, rowsFromArrays } = require('./checklist');
const { audit } = require('./audit');

const demo = process.argv.includes('--demo');
const resetAdmin = process.argv.includes('--reset-admin');

async function ensureAdmin() {
  const { rows } = await db.query('SELECT id, email FROM company_users WHERE lower(email) = lower($1)', [config.adminEmail]);
  if (rows.length) {
    await db.query('UPDATE company_users SET password_hash = $2 WHERE id = $1', [rows[0].id, scryptHash(config.adminPassword)]);
    console.log(`Synced admin credentials for ${config.adminEmail}`);
    return rows[0].id;
  }

  const existing = await db.query('SELECT id, email FROM company_users ORDER BY created_at ASC LIMIT 1');
  if (existing.rows.length) {
    await db.query('UPDATE company_users SET email = $1, password_hash = $2 WHERE id = $3', [
      config.adminEmail, scryptHash(config.adminPassword), existing.rows[0].id
    ]);
    console.log(`Updated admin user from ${existing.rows[0].email} to ${config.adminEmail} with new password`);
    return existing.rows[0].id;
  }

  const id = uuid();
  await db.query(
    'INSERT INTO company_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
    [id, config.adminEmail, 'UAT Desk Admin', scryptHash(config.adminPassword)]
  );
  console.log(`Created company user ${config.adminEmail}`);
  return id;
}

async function seedDemoProject({ token, password, productName, clientName, version, ownerName, ownerEmail, rows, adminId, results }) {
  const existing = await db.query('SELECT project_id FROM access_links WHERE upper(token) = upper($1)', [token]);
  if (existing.rows.length) {
    console.log(`Demo project ${token} already exists, skipping.`);
    return;
  }
  const product = await service.findOrCreateProduct(productName);
  const client = await service.findOrCreateClient(clientName);
  const projectId = await service.createProject({
    productId: product.id,
    clientId: client.id,
    version,
    ownerName,
    ownerEmail,
    createdBy: adminId,
    rows,
    token,
    passwordHash: scryptHash(password),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    checklistFilename: 'demo-checklist.xlsx'
  });
  await audit({
    projectId,
    actor: config.adminEmail,
    action: 'project.created',
    detail: `${token} · ${rows.length} items (demo seed)`
  });

  if (results && results.length) {
    const bundle = await service.getProjectBundle(projectId);
    const byCode = new Map(bundle.milestones.flatMap(m => m.items).map(i => [i.code, i]));
    for (const result of results) {
      const item = byCode.get(result.code);
      if (!item) continue;
      await service.addResult({
        itemId: item.id,
        status: result.status,
        comment: result.comment || '',
        testerName: result.tester || 'Priya Nair',
        testerEmail: result.email || 'priya@acme.example',
        createdBy: result.tester || 'Priya Nair'
      });
    }
  }
  console.log(`Created demo project ${token} / ${password}`);
}

(async () => {
  const adminId = await ensureAdmin();

  if (demo) {
    await seedDemoProject({
      token: 'UAT-ACME23',
      password: 'acme-uat-2026',
      productName: 'Acme Inventory',
      clientName: 'Acme Retail',
      version: 'v1.0',
      ownerName: 'Rohit Menon',
      ownerEmail: 'rohit@acme-company.example',
      rows: rowsFromArrays(INV_ROWS),
      adminId,
      results: [
        { code: 'AR-01', status: 'pass', comment: 'Signed in with the test account and landed on the dashboard.' },
        { code: 'AR-02', status: 'pass', comment: 'Billing is hidden for the warehouse manager.' },
        { code: 'AR-03', status: 'na', comment: 'No non-SSO users in this release.' },
        { code: 'SW-01', status: 'pass', comment: 'SKU created and found in search.' },
        {
          code: 'SW-02',
          status: 'fail',
          comment: 'Transfer showed Completed but the destination warehouse stock did not change.',
          tester: 'Priya Nair'
        }
      ]
    });

    await seedDemoProject({
      token: 'UAT-NWFS10',
      password: 'northwind-fs-01',
      productName: 'Northwind Field Service',
      clientName: 'Northwind Logistics',
      version: 'v2.4',
      ownerName: 'Rohit Menon',
      ownerEmail: 'rohit@acme-company.example',
      rows: rowsFromArrays(FS_ROWS),
      adminId,
      results: []
    });
  }

  console.log('\nSeed complete.');
  console.log(`Company sign in: ${config.adminEmail} / ${config.adminPassword}`);
  if (demo) {
    console.log('Demo client 1: UAT-ACME23 / acme-uat-2026 (Acme Retail, one failed item)');
    console.log('Demo client 2: UAT-NWFS10 / northwind-fs-01 (Northwind Logistics, fresh)');
  }
  await db.pool.end();
})().catch(async err => {
  console.error('Seed failed', err);
  try { await db.pool.end(); } catch (e) { /* ignore */ }
  process.exit(1);
});
