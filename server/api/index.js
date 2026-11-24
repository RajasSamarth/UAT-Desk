const config = require('../src/config');
const { createApp } = require('../src/app');
const serverless = require('serverless-http');
const dns = require('node:dns');

// Serverless hosts are IPv4-only; make sure a hostname that also has AAAA
// records can never stall the connection attempt on an unreachable IPv6 route.
dns.setDefaultResultOrder('ipv4first');

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

// Fire-and-forget connectivity check. A hung request still leaves these lines in
// the platform logs, so we can see which hop (DNS, TCP, PostgreSQL) stalls.
require('../src/diagnostics').probe();

module.exports = handler;
module.exports.handler = handler;
