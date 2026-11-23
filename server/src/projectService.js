const db = require('./db');
const { uuid } = require('./security');
const { rowsToMilestones } = require('./checklist');

const DAY = 86400000;

function itemTested(item) {
  return item.status === 'pass' || item.status === 'fail' || item.status === 'na';
}

function itemDone(item) {
  return item.status === 'pass' || item.status === 'na';
}

function milestoneComplete(milestone) {
  return milestone.items.length > 0 && milestone.items.every(itemTested);
}

function computeStats(bundle) {
  const items = bundle.milestones.flatMap(m => m.items);
  return {
    total: items.length,
    done: items.filter(itemDone).length,
    fail: items.filter(i => i.status === 'fail').length,
    retest: items.filter(i => i.status === 'retest').length,
    tested: items.filter(i => i.status).length
  };
}

function milestoneState(bundle, index) {
  if (milestoneComplete(bundle.milestones[index])) return 'complete';
  for (let i = 0; i < index; i += 1) {
    if (!milestoneComplete(bundle.milestones[i])) return 'locked';
  }
  return 'open';
}

function currentMilestoneIndex(bundle) {
  return bundle.milestones.findIndex(m => !milestoneComplete(m));
}

function isExpired(bundle) {
  if (!bundle.link.expires_at) return false;
  const end = new Date(`${bundle.link.expires_at}T23:59:59`);
  return Date.now() > end.getTime();
}

function projectStatus(bundle) {
  if (bundle.signoff) return 'signed';
  if (bundle.link.revoked_at) return 'revoked';
  if (isExpired(bundle)) return 'expired';
  const s = computeStats(bundle);
  if (s.total && s.tested === s.total) return 'ready';
  if (s.tested === 0) return 'not-started';
  return 'in-progress';
}

async function getProjectBundle(projectId) {
  const { rows } = await db.query(
    `SELECT p.*, pr.name AS product_name, c.name AS client_name,
            l.token, to_char(l.expires_at, 'YYYY-MM-DD') AS expires_at, l.revoked_at, l.rotated_at, l.created_at AS link_created_at
       FROM projects p
       JOIN products pr ON pr.id = p.product_id
       JOIN clients c ON c.id = p.client_id
       JOIN access_links l ON l.project_id = p.id
      WHERE p.id = $1`,
    [projectId]
  );
  if (!rows.length) return null;
  const project = rows[0];

  const { rows: milestoneRows } = await db.query(
    'SELECT id, position, name FROM milestones WHERE project_id = $1 ORDER BY position',
    [projectId]
  );

  const { rows: itemRows } = await db.query(
    `SELECT i.id, i.milestone_id, i.code, i.title, i.steps, i.expected, i.mandatory, i.evidence, i.position,
            i.image_key, r.status, r.comment, r.fix_note, r.tester_name, r.tester_email,
            r.created_at AS tested_at, r.created_by AS result_by
       FROM checklist_items i
       LEFT JOIN LATERAL (
         SELECT * FROM item_results ir
          WHERE ir.item_id = i.id
          ORDER BY ir.created_at DESC, ir.id DESC
          LIMIT 1
       ) r ON true
      WHERE i.project_id = $1
      ORDER BY i.position`,
    [projectId]
  );

  const byMilestone = new Map();
  for (const item of itemRows) {
    if (!byMilestone.has(item.milestone_id)) byMilestone.set(item.milestone_id, []);
    byMilestone.get(item.milestone_id).push(item);
  }

  const milestones = milestoneRows.map(m => ({ ...m, items: byMilestone.get(m.id) || [] }));

  const { rows: signoffRows } = await db.query('SELECT * FROM signoffs WHERE project_id = $1', [projectId]);

  const bundle = {
    project,
    product: { name: project.product_name },
    client: { name: project.client_name },
    link: {
      token: project.token,
      expires_at: project.expires_at,
      revoked_at: project.revoked_at,
      rotated_at: project.rotated_at
    },
    milestones,
    signoff: signoffRows[0] || null
  };
  bundle.stats = computeStats(bundle);
  bundle.states = milestones.map((_, i) => milestoneState(bundle, i));
  bundle.currentIndex = currentMilestoneIndex(bundle);
  bundle.status = projectStatus(bundle);
  bundle.expired = isExpired(bundle);
  return bundle;
}

async function getProjectByToken(token) {
  const { rows } = await db.query(
    `SELECT p.id FROM projects p JOIN access_links l ON l.project_id = p.id WHERE upper(l.token) = upper($1)`,
    [String(token || '')]
  );
  if (!rows.length) return null;
  return getProjectBundle(rows[0].id);
}

async function findOrCreateProduct(name) {
  const clean = String(name || '').trim();
  const { rows } = await db.query('SELECT id, name FROM products WHERE lower(name) = lower($1) LIMIT 1', [clean]);
  if (rows.length) return rows[0];
  const id = uuid();
  await db.query('INSERT INTO products (id, name) VALUES ($1, $2)', [id, clean]);
  return { id, name: clean };
}

async function findOrCreateClient(name) {
  const clean = String(name || '').trim();
  const { rows } = await db.query('SELECT id, name FROM clients WHERE lower(name) = lower($1) LIMIT 1', [clean]);
  if (rows.length) return rows[0];
  const id = uuid();
  await db.query('INSERT INTO clients (id, name) VALUES ($1, $2)', [id, clean]);
  return { id, name: clean };
}

async function createProject({
  productId, clientId, version, ownerName, ownerEmail, createdBy,
  rows, token, passwordHash, expiresAt, checklistKey, checklistFilename
}) {
  const conn = await db.pool.connect();
  try {
    await conn.query('BEGIN');
    const projectId = uuid();
    await conn.query(
      `INSERT INTO projects
         (id, product_id, client_id, version, owner_name, owner_email, created_by, checklist_key, checklist_filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [projectId, productId, clientId, version, ownerName, ownerEmail || null, createdBy || null, checklistKey || null, checklistFilename || null]
    );
    await conn.query(
      `INSERT INTO access_links (id, project_id, token, password_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuid(), projectId, token, passwordHash, expiresAt]
    );

    const milestones = rowsToMilestones(rows);
    let position = 0;
    for (const milestone of milestones) {
      const milestoneId = uuid();
      await conn.query(
        'INSERT INTO milestones (id, project_id, position, name) VALUES ($1, $2, $3, $4)',
        [milestoneId, projectId, milestone.order, milestone.name]
      );
      for (const item of milestone.items) {
        position += 1;
        await conn.query(
          `INSERT INTO checklist_items
             (id, project_id, milestone_id, code, title, steps, expected, mandatory, evidence, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [uuid(), projectId, milestoneId, item.code, item.title, item.steps || '', item.expected || '', !!item.mandatory, !!item.evidence, position]
        );
      }
    }
    await conn.query('COMMIT');
    return projectId;
  } catch (err) {
    await conn.query('ROLLBACK');
    throw err;
  } finally {
    conn.release();
  }
}

async function addResult({ itemId, status, comment = '', fixNote = '', imageKey = null, testerName = null, testerEmail = null, createdBy }) {
  const id = uuid();
  await db.query(
    `INSERT INTO item_results
       (id, item_id, status, comment, fix_note, image_key, tester_name, tester_email, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, itemId, status, comment, fixNote, imageKey, testerName, testerEmail, createdBy]
  );
  return id;
}

async function addTester(projectId, name, email) {
  await db.query(
    `INSERT INTO testers (id, project_id, name, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id, email) DO UPDATE SET name = EXCLUDED.name`,
    [uuid(), projectId, name, String(email).toLowerCase()]
  );
}

async function rotatePassword(projectId, passwordHash) {
  await db.query(
    `UPDATE access_links
        SET password_hash = $2, rotated_at = now(), failed_attempts = 0, locked_until = null
      WHERE project_id = $1`,
    [projectId, passwordHash]
  );
}

async function setExpiry(projectId, date) {
  await db.query('UPDATE access_links SET expires_at = $2 WHERE project_id = $1', [projectId, date]);
}

async function setRevoked(projectId, revoked) {
  await db.query('UPDATE access_links SET revoked_at = $2 WHERE project_id = $1', [projectId, revoked ? new Date() : null]);
}

async function recordAccessFailure(linkId) {
  const { rows } = await db.query(
    `UPDATE access_links
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
      WHERE id = $1
      RETURNING failed_attempts, locked_until`,
    [linkId]
  );
  return rows[0];
}

async function clearAccessFailures(linkId) {
  await db.query('UPDATE access_links SET failed_attempts = 0, locked_until = null WHERE id = $1', [linkId]);
}

async function getAudit(projectId, limit = 50) {
  const { rows } = await db.query(
    'SELECT actor, action, detail, ip, at FROM audit_log WHERE project_id = $1 ORDER BY at DESC LIMIT $2',
    [projectId, limit]
  );
  return rows;
}

async function getDashboard() {
  const { rows } = await db.query(
    `SELECT p.id, p.version, p.owner_name, p.created_at,
            pr.name AS product_name, c.name AS client_name,
            l.token, to_char(l.expires_at, 'YYYY-MM-DD') AS expires_at, l.revoked_at,
            so.verification_id, so.signed_at,
            COALESCE(s.total, 0) AS total,
            COALESCE(s.done, 0) AS done,
            COALESCE(s.fail, 0) AS fail,
            COALESCE(s.retest, 0) AS retest,
            COALESCE(s.tested, 0) AS tested,
            COALESCE(mc.milestone_count, 0) AS milestone_count,
            cm.current_milestone
       FROM projects p
       JOIN products pr ON pr.id = p.product_id
       JOIN clients c ON c.id = p.client_id
       JOIN access_links l ON l.project_id = p.id
       LEFT JOIN signoffs so ON so.project_id = p.id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS total,
                count(*) FILTER (WHERE r.status IN ('pass', 'na'))::int AS done,
                count(*) FILTER (WHERE r.status = 'fail')::int AS fail,
                count(*) FILTER (WHERE r.status = 'retest')::int AS retest,
                count(*) FILTER (WHERE r.status IS NOT NULL)::int AS tested
           FROM checklist_items i
           LEFT JOIN LATERAL (
             SELECT status FROM item_results ir WHERE ir.item_id = i.id ORDER BY ir.created_at DESC, ir.id DESC LIMIT 1
           ) r ON true
          WHERE i.project_id = p.id
       ) s ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS milestone_count FROM milestones m WHERE m.project_id = p.id
       ) mc ON true
       LEFT JOIN LATERAL (
         SELECT m.name AS current_milestone
           FROM milestones m
          WHERE m.project_id = p.id
            AND EXISTS (
              SELECT 1
                FROM checklist_items i
                LEFT JOIN LATERAL (
                  SELECT status FROM item_results ir WHERE ir.item_id = i.id ORDER BY ir.created_at DESC, ir.id DESC LIMIT 1
                ) r ON true
               WHERE i.milestone_id = m.id AND (r.status IS NULL OR r.status NOT IN ('pass', 'na'))
            )
          ORDER BY m.position
          LIMIT 1
       ) cm ON true
      ORDER BY GREATEST(p.created_at, COALESCE(so.signed_at, p.created_at)) DESC`
  );
  return rows.map(r => {
    const expired = r.expires_at && Date.now() > new Date(`${r.expires_at}T23:59:59`).getTime();
    let status = 'in-progress';
    if (r.verification_id) status = 'signed';
    else if (r.revoked_at) status = 'revoked';
    else if (expired) status = 'expired';
    else if (r.total > 0 && r.done === r.total) status = 'ready';
    else if (r.tested === 0) status = 'not-started';
    return { ...r, expired, status };
  });
}

module.exports = {
  DAY,
  itemTested,
  itemDone,
  milestoneComplete,
  computeStats,
  milestoneState,
  currentMilestoneIndex,
  isExpired,
  projectStatus,
  getProjectBundle,
  getProjectByToken,
  findOrCreateProduct,
  findOrCreateClient,
  createProject,
  addResult,
  addTester,
  rotatePassword,
  setExpiry,
  setRevoked,
  recordAccessFailure,
  clearAccessFailures,
  getAudit,
  getDashboard
};
