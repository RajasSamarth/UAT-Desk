const config = require('./config');
const db = require('./db');
const storage = require('./storage');
const { createApp } = require('./app');

(async () => {
  await storage.init();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`UAT Desk listening on ${config.appBaseUrl} (port ${config.port})`);
    console.log(`Note: Local dev runs on HTTP only. Open http://127.0.0.1:${config.port} (do NOT use https://).`);
    if (!config.smtpUrl) {
      if (config.isProd) {
        console.warn('WARNING: SMTP_URL is not set. Sign-off emails will fail in production.');
      } else {
        console.log('No SMTP_URL: emails are logged and written to the dev outbox table.');
      }
    }
    if (config.sessionSecret === 'dev-only-change-me') {
      console.warn('WARNING: SESSION_SECRET is the development default. Change it before deploying.');
    }
  });

  function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await db.pool.end();
        console.log('Database pool closed.');
      } catch (err) {
        console.error('Error closing database pool:', err);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})().catch(err => {
  console.error('Failed to start', err);
  process.exit(1);
});
