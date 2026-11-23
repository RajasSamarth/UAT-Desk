const rateLimit = require('express-rate-limit');

const errorHandler = (req, res) => {
  res.status(429).render('error', {
    title: 'Too many attempts',
    side: 'public',
    status: 429,
    message: 'Too many attempts from this address. Wait a few minutes and try again.'
  });
};

const companyLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: errorHandler
});

const clientLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: errorHandler
});

const otp = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: errorHandler
});

const verify = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: errorHandler
});

module.exports = { companyLogin, clientLogin, otp, verify };
