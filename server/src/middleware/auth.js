const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { unauthorized, wrap } = require('../utils/errors');

const COOKIE = 'halyard_token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function issueToken(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '8h' });
  const prod = config.env === 'production';
  res.cookie(COOKIE, token, {
    httpOnly: true, 
    secure: prod,
    sameSite: config.crossSiteCookies ? 'none' : 'lax',
    maxAge: MAX_AGE_MS,
  });
  return token;
}
const clearToken = (res) => res.clearCookie(COOKIE);


const requireAuth = wrap(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[COOKIE] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw unauthorized();
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); } catch { throw unauthorized('Session expired or invalid'); }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  req.user = user;
  next();
});

const requireAdmin = (req, _res, next) =>
  req.user.role === 'admin' ? next() : next(require('../utils/errors').forbidden('Admin only'));

function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'halyard') {
    return next(require('../utils/errors').forbidden('Missing X-Requested-With header'));
  }
  next();
}
module.exports = { requireAuth, requireAdmin, csrfGuard, issueToken, clearToken };
