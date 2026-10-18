const router = require('express').Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const svc = require('../services/workItems');
const Comment = require('../models/Comment');
const Activity = require('../models/ActivityLog');
const WorkItem = require('../models/WorkItem');
const { access } = require('../services/access');
const { STATUSES, PRIORITIES, CATEGORIES } = require('../services/workflow');
const { validate } = require('../middleware/error');
const { wrap, badRequest, forbidden } = require('../utils/errors');

const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const csv = (values) => z.string().optional().transform((s) => (s ? s.split(',') : undefined))
  .pipe(z.array(z.enum(values)).optional());
const dueDate = z.union([z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)), z.null()])
  .transform((v) => (v ? new Date(v) : null));
const version = z.number().int().min(1, 'version is required');

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: csv(STATUSES), priority: csv(PRIORITIES),
  team: oid.optional(),
  assignee: z.union([z.literal('me'), z.literal('unassigned'), oid]).optional(),
  overdue: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  due: z.enum(['today', 'week']).optional(),
  sort: z.enum(['updated', 'created', 'priority']).default('updated'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });

const createSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  description: z.string().max(5000).default(''),
  category: z.enum(CATEGORIES).default('task'),
  priority: z.enum(PRIORITIES).default('medium'),
  team: oid, dueDate: dueDate.optional(),
});
const updateSchema = z.object({
  version,
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: dueDate.optional(),
});

router.get('/', validate(listQuery, 'query'), wrap(async (req, res) => res.json(await svc.listItems(req.user, req.validQuery))));
router.get('/stats', wrap(async (req, res) => res.json(await svc.stats(req.user))));

router.post('/', validate(createSchema), wrap(async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key || key.length > 100) throw badRequest('An Idempotency-Key header (max 100 chars) is required', { fields: { _: 'Missing Idempotency-Key' } });
  const { item, replayed } = await svc.createItem(req.user, key, req.body);
  res.set('Idempotent-Replayed', String(replayed)).status(replayed ? 200 : 201).json({ item });
}));

router.get('/:id', wrap(async (req, res) => {
  const item = await svc.loadVisible(req.user, req.params.id);
  const a = access(req.user, item);
  res.json({ item: svc.toDTO(item), permissions: { edit: a.canEdit, assign: a.canAssign, claim: a.canClaim, comment: a.canComment, manage: a.isManager } });
}));

router.patch('/:id', validate(updateSchema), wrap(async (req, res) => res.json({ item: await svc.updateItem(req.user, req.params.id, req.body) })));
router.post('/:id/claim', wrap(async (req, res) => res.json({ item: await svc.claimItem(req.user, req.params.id) })));
router.post('/:id/assign', validate(z.object({ version, assigneeId: oid.nullable() })), wrap(async (req, res) =>
  res.json({ item: await svc.assignItem(req.user, req.params.id, req.body) })));
router.patch('/:id/status', validate(z.object({ version, status: z.enum(STATUSES) })), wrap(async (req, res) =>
  res.json({ item: await svc.changeStatus(req.user, req.params.id, req.body) })));

router.get('/:id/comments', validate(pageQuery, 'query'), wrap(async (req, res) => {
  const item = await svc.loadVisible(req.user, req.params.id);
  const { page, limit } = req.validQuery;
  const [rows, total] = await Promise.all([
    Comment.find({ workItem: item._id }).sort('-createdAt').skip((page - 1) * limit).limit(limit).populate('author', 'name'),
    Comment.countDocuments({ workItem: item._id }),
  ]);
  res.json({ comments: rows.map((c) => ({ id: c._id, body: c.body, author: c.author, createdAt: c.createdAt })), page, total, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.post('/:id/comments', validate(z.object({ body: z.string().trim().min(1, 'Comment cannot be empty').max(2000) })), wrap(async (req, res) => {
  const item = await svc.loadVisible(req.user, req.params.id);
  if (!access(req.user, item).canComment) throw forbidden();
  const c = await Comment.create({ workItem: item._id, author: req.user._id, body: req.body.body });
  await svc.log(item, req.user, 'commented', { commentId: String(c._id) });
  await WorkItem.updateOne({ _id: item._id }, { $currentDate: { updatedAt: true } });
  res.status(201).json({ comment: { id: c._id, body: c.body, author: { _id: req.user._id, name: req.user.name }, createdAt: c.createdAt } });
}));

router.get('/:id/activity', validate(pageQuery, 'query'), wrap(async (req, res) => {
  const item = await svc.loadVisible(req.user, req.params.id);
  const { page, limit } = req.validQuery;
  const [rows, total] = await Promise.all([
    Activity.find({ workItem: item._id }).sort('-createdAt').skip((page - 1) * limit).limit(limit).populate('actor', 'name'),
    Activity.countDocuments({ workItem: item._id }),
  ]);
  res.json({ activity: rows.map((a) => ({ id: a._id, type: a.type, data: a.data, actor: a.actor, createdAt: a.createdAt, versionAfter: a.versionAfter })), page, total, pages: Math.max(1, Math.ceil(total / limit)) });
}));

module.exports = router;
