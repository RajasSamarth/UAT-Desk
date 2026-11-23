const db = require('./db');

async function audit({ projectId = null, actor = 'system', action, detail = '', req = null }) {
  try {
    await db.query(
      `INSERT INTO audit_log (project_id, actor, action, detail, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectId, actor, action, detail, req ? req.ip : null, req ? req.get('user-agent') : null]
    );
  } catch (err) {
    // Audit must never take the request down, but it must be visible.
    console.error('Audit log write failed', err);
  }
}

module.exports = { audit };
