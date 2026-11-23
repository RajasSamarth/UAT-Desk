const { Pool } = require('pg');
const config = require('./config');

const isRemoteDb = config.databaseUrl && (
  config.databaseUrl.includes('supabase.co') ||
  config.databaseUrl.includes('pooler.supabase.com') ||
  config.databaseUrl.includes('neon.tech') ||
  config.databaseUrl.includes('sslmode=require') ||
  process.env.DATABASE_SSL === 'true'
);

const poolConfig = {
  connectionString: config.databaseUrl,
  max: Number(process.env.PG_POOL_MAX || 10)
};

if (isRemoteDb) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('error', err => {
  console.error('Unexpected PostgreSQL pool error', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
