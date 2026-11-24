const { createApp } = require('../src/app');
const serverless = require('serverless-http');

const app = createApp();
const handler = serverless(app);

module.exports = handler;
module.exports.handler = handler;
