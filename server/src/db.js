const { Pool } = require('pg');
const config = require('./config');

const isRemoteDb = config.databaseUrl && (
  config.databaseUrl.includes('supabase.co') ||
  config.databaseUrl.includes('pooler.supabase.com') ||
  config.databaseUrl.includes('neon.tech') ||
  config.databaseUrl.includes('sslmode=require') ||
  process.env.DATABASE_SSL === 'true'
);

// Fail fast. Without these, a bad hostname leaves the request hanging until the
// platform kills the function (Vercel waits 300s and returns 504).
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const poolConfig = {
  connectionString: config.databaseUrl,
  max: num(process.env.PG_POOL_MAX, 5),
  connectionTimeoutMillis: num(process.env.PG_CONNECT_TIMEOUT_MS, 10000),
  idleTimeoutMillis: num(process.env.PG_IDLE_TIMEOUT_MS, 30000),
  statement_timeout: num(process.env.PG_STATEMENT_TIMEOUT_MS, 20000),
  query_timeout: num(process.env.PG_QUERY_TIMEOUT_MS, 25000),
  keepAlive: true
};

if (isRemoteDb) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

console.log(`[db] host=${config.databaseHost || '(unset)'} ssl=${Boolean(poolConfig.ssl)} max=${poolConfig.max}`);

pool.on('error', err => {
  console.error('Unexpected PostgreSQL pool error', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
