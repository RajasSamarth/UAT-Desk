const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const env = process.env;
const isProd = (env.NODE_ENV || 'development') === 'production';
const bool = v => String(v).toLowerCase() === 'true';

module.exports = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: Number(env.PORT || 3000),
  appBaseUrl: (env.APP_BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, ''),
  databaseUrl: env.DATABASE_URL || 'postgres://uat:uat@localhost:5432/uatdesk',
  sessionSecret: env.SESSION_SECRET || 'dev-only-change-me',
  adminEmail: (env.ADMIN_EMAIL || 'admin@uatdesk.local').toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || 'change-me-now',
  mailFrom: env.MAIL_FROM || 'UAT Desk <no-reply@uatdesk.local>',
  smtpUrl: env.SMTP_URL || '',
  cookieSecure: env.COOKIE_SECURE ? bool(env.COOKIE_SECURE) : isProd,
  storageDriver: env.STORAGE_DRIVER || 'local',
  storageDir: path.resolve(__dirname, '..', env.STORAGE_DIR || './storage'),
  s3: {
    endpoint: env.S3_ENDPOINT || '',
    region: env.S3_REGION || 'us-east-1',
    bucket: env.S3_BUCKET || 'uatdesk',
    accessKeyId: env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
    forcePathStyle: bool(env.S3_FORCE_PATH_STYLE)
  },
  trustProxy: env.TRUST_PROXY === 'true'
};
