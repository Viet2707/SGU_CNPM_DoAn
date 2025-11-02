const rateLimit = require('express-rate-limit');

const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: 120
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 60
});

module.exports = { publicLimiter, authLimiter };
