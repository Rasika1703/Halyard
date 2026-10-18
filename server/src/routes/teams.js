const router = require('express').Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const Team = require('../models/Team');
const User = require('../models/User');
const { validate } = require('../middleware/error');
const { requireAdmin } = require('../middleware/auth');
const { wrap, notFound, forbidden, badRequest } = require('../utils/errors');

router.get('/', wrap(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { _id: { $in: req.user.memberships.map((m) => m.team) } };
  const teams = await Team.find(filter).sort('name');
  res.json({ teams: teams.map((t) => ({ id: t._id, name: t.name, key: t.key, myRole: req.user.teamRole(t._id) })) });
}));

router.post('/', requireAdmin, validate(z.object({
  name: z.string().trim().min(2).max(60), key: z.string().trim().min(2).max(6).regex(/^[A-Za-z0-9]+$/, 'Letters and digits only'),
})), wrap(async (req, res) => {
  try {
    const t = await Team.create(req.body);
    res.status(201).json({ team: { id: t._id, name: t.name, key: t.key } });
  } catch (e) {
    if (e.code === 11000) throw badRequest('A team with that name or key already exists');
    throw e;
  }
}));


router.get('/:id/members', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  if (req.user.role !== 'admin' && !req.user.teamRole(req.params.id)) throw forbidden('Not a member of this team');
  const users = await User.find({ 'memberships.team': req.params.id }).sort('name');
  res.json({ members: users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.teamRole(req.params.id) })) });
}));

router.post('/:id/members', requireAdmin, validate(z.object({
  email: z.string().trim().toLowerCase().email(), role: z.enum(['manager', 'member']).default('member'),
})), wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !(await Team.exists({ _id: req.params.id }))) throw notFound('Team not found');
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw notFound('No user with that email');
  user.memberships = user.memberships.filter((m) => String(m.team) !== req.params.id);
  user.memberships.push({ team: req.params.id, role: req.body.role });
  await user.save();
  res.json({ user: user.toPublic() });
}));

module.exports = router;
