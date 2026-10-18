require('dotenv').config();
module.exports = {
  port: process.env.PORT || 4000,
  env: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret' : undefined),
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === 'true',
};
