const config = require('../src/config');
const { createApp } = require('../src/app');
const serverless = require('serverless-http');

// One line per cold start: tells us exactly which values the running function
// actually received, without leaking secrets. If this line shows the wrong DB
// host, the deployment (or its environment scope) is stale.
function safeHost(url) {
  if (!url) return '(unset)';
  try {
    return new URL(url).host;
  } catch {
    return '(invalid url)';
  }
}

console.log(
  '[boot]',
  JSON.stringify({
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    region: process.env.VERCEL_REGION || null,
    dbHost: config.databaseHost || '(unset)',
    storageDriver: config.storageDriver,
    s3Endpoint: safeHost(config.s3.endpoint),
    s3Bucket: config.s3.bucket,
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
    missingEnv: config.missingEnv
  })
);

const app = createApp();
const handler = serverless(app);

module.exports = handler;
module.exports.handler = handler;
