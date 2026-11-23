const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

async function main() {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
  );

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (rows.length) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const conn = await db.pool.connect();
    try {
      await conn.query('BEGIN');
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await conn.query('COMMIT');
      console.log(`apply  ${file}`);
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  }

  await db.pool.end();
  console.log('Migrations complete.');
}

main().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});
