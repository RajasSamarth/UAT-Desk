const config = require('./config');
const db = require('./db');

const REQUIRED_TABLES = [
  'company_users',
  'products',
  'clients',
  'projects',
  'access_links',
  'milestones',
  'checklist_items',
  'item_results',
  'testers',
  'otp_challenges',
  'signoffs',
  'audit_log',
  'dev_outbox'
];

function redact(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '****';
    return parsed.toString();
  } catch {
    return String(url).replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  }
}

(async () => {
  console.log(`Database:  ${redact(config.databaseUrl)}`);
  console.log(`Pool max:  ${Number(process.env.PG_POOL_MAX || 10)}`);

  if (config.databaseUrl.includes(':6543')) {
    console.warn('Warning: port 6543 is the Supabase transaction pooler.');
    console.warn('Use the session pooler on port 5432 for this app (sessions + prepared statements).');
  }

  const { rows: infoRows } = await db.query(
    'SELECT version() AS version, current_database() AS db, current_user AS usr'
  );
  const info = infoRows[0];
  console.log(`Server:    ${String(info.version).split(',')[0]}`);
  console.log(`Database:  ${info.db} (user ${info.usr})`);

  const { rows: tableRows } = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  const tables = tableRows.map(r => r.table_name);
  console.log(`Tables:    ${tables.length}${tables.length ? ` (${tables.join(', ')})` : ''}`);

  let applied = 0;
  if (tables.includes('schema_migrations')) {
    const { rows } = await db.query('SELECT count(*)::int AS n FROM schema_migrations');
    applied = rows[0].n;
  }
  console.log(`Migrations applied: ${applied}`);

  const missing = REQUIRED_TABLES.filter(t => !tables.includes(t));
  if (missing.length) {
    console.warn(`Missing tables: ${missing.join(', ')}`);
    console.warn('Run: npm run migrate');
    process.exitCode = 1;
  } else {
    console.log('Schema:    OK');
  }

  await db.pool.end();
})().catch(async err => {
  console.error(`Database check failed: ${err.message}`);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
