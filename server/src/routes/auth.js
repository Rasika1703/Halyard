const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { validate } = require('../middleware/error');
const { requireAuth, issueToken, clearToken } = require('../middleware/auth');
const { wrap, AppError, unauthorized } = require('../utils/errors');
const config = require('../config');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1, 'Password is required') });

router.post('/register', limiter, validate(registerSchema), wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  issueToken(res, user);
  res.status(201).json({ user: user.toPublic() });
}));

router.post('/login', limiter, validate(loginSchema), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw unauthorized('Incorrect email or password');
  issueToken(res, user);
  res.json({ user: user.toPublic() });
}));

router.post('/logout', (_req, res) => { clearToken(res); res.status(204).end(); });
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

module.exports = router;
