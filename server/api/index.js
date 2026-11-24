const dns = require('node:dns');

const config = require('../src/config');
const { createApp } = require('../src/app');

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

// Fire-and-forget connectivity check. A hung request still leaves these lines in
// the platform logs, so we can see which hop (DNS, TCP, PostgreSQL) stalls.
require('../src/diagnostics').probe();

// Vercel's Node.js runtime invokes api/* with a real IncomingMessage /
// ServerResponse pair, so the Express app is the handler. Do NOT wrap this in
// serverless-http: that adapter answers an AWS Lambda proxy event and returns
// {statusCode, body} instead of ending the real response, which makes Vercel
// wait for a response that never arrives (300s timeout, 504, empty body).
module.exports = app;
