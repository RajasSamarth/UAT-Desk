const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const env = process.env;
const isProd = (env.NODE_ENV || 'development') === 'production';
const isServerless = Boolean(env.VERCEL || env.VERCEL_ENV);
// Enforce required configuration on Vercel even if NODE_ENV is not set there.
const enforceEnv = isProd || isServerless;
const bool = v => String(v).toLowerCase() === 'true';
// Vercel (and copy/paste in general) often leaves stray whitespace or newlines
// around values. Trim everything so a trailing "\n" cannot break a hostname.
const str = (v, fallback = '') => {
  if (v === undefined || v === null) return fallback;
  const trimmed = String(v).trim();
  return trimmed === '' ? fallback : trimmed;
};

const databaseUrl = str(env.DATABASE_URL, enforceEnv ? '' : 'postgres://uat:uat@localhost:5432/uatdesk');

// A deployment with no environment variables used to fall back to localhost and
// then fail with "ECONNREFUSED 127.0.0.1:5432", which hides the real problem.
// Detect the missing configuration up front and report it explicitly.
const REQUIRED_ENV = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'ADMIN_PASSWORD',
  'STORAGE_DRIVER',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY'
];
const RECOMMENDED_ENV = ['APP_BASE_URL', 'ADMIN_EMAIL', 'TRUST_PROXY', 'COOKIE_SECURE'];

const missingEnv = enforceEnv ? REQUIRED_ENV.filter(key => !str(env[key])) : [];
const unsetRecommended = RECOMMENDED_ENV.filter(key => !str(env[key]));

if (missingEnv.length) {
  console.error(
    `[config] MISSING required environment variables for this deployment: ${missingEnv.join(', ')}. ` +
      'They are not attached to the running deployment - check that they exist in THIS Vercel project, ' +
      'scoped to the Production environment, then redeploy.'
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

const databaseHost = hostOf(databaseUrl);

// Supabase's direct connection host (db.<ref>.supabase.co) is IPv6-only, and
// serverless platforms such as Vercel have no IPv6 route. The session pooler
// (aws-<n>-<region>.pooler.supabase.com:5432) must be used instead. Warn loudly
// at boot so the logs name the problem instead of only showing a timeout.
if (/^db\.[a-z0-9-]+\.supabase\.co$/i.test(databaseHost)) {
  console.error(
    `[config] DATABASE_URL points at the Supabase DIRECT host "${databaseHost}", which is IPv6-only and unreachable from Vercel. ` +
      'Use the Session pooler instead: postgresql://postgres.<project-ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres'
  );
}

module.exports = {
  env: env.NODE_ENV || 'development',
  isProd,
  isServerless,
  missingEnv,
  unsetRecommended,
  port: Number(env.PORT || 3000),
  appBaseUrl: str(env.APP_BASE_URL, `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, ''),
  databaseUrl,
  databaseHost,
  sessionSecret: str(env.SESSION_SECRET, 'dev-only-change-me'),
  adminEmail: str(env.ADMIN_EMAIL, 'admin@uatdesk.local').toLowerCase(),
  adminPassword: str(env.ADMIN_PASSWORD, 'change-me-now'),
  mailFrom: str(env.MAIL_FROM, 'UAT Desk <no-reply@uatdesk.local>'),
  smtpUrl: str(env.SMTP_URL),
  cookieSecure: env.COOKIE_SECURE ? bool(env.COOKIE_SECURE) : isProd,
  storageDriver: str(env.STORAGE_DRIVER, 'local'),
  storageDir: path.resolve(__dirname, '..', str(env.STORAGE_DIR, './storage')),
  s3: {
    endpoint: str(env.S3_ENDPOINT),
    region: str(env.S3_REGION, 'us-east-1'),
    bucket: str(env.S3_BUCKET, 'uatdesk'),
    accessKeyId: str(env.S3_ACCESS_KEY_ID),
    secretAccessKey: str(env.S3_SECRET_ACCESS_KEY),
    forcePathStyle: bool(env.S3_FORCE_PATH_STYLE)
  },
  trustProxy: env.TRUST_PROXY === 'true'
};
