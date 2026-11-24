const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const env = process.env;
const isProd = (env.NODE_ENV || 'development') === 'production';
const bool = v => String(v).toLowerCase() === 'true';
// Vercel (and copy/paste in general) often leaves stray whitespace or newlines
// around values. Trim everything so a trailing "\n" cannot break a hostname.
const str = (v, fallback = '') => {
  if (v === undefined || v === null) return fallback;
  const trimmed = String(v).trim();
  return trimmed === '' ? fallback : trimmed;
};

const databaseUrl = str(env.DATABASE_URL, 'postgres://uat:uat@localhost:5432/uatdesk');

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
