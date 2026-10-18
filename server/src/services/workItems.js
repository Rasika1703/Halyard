const crypto = require('crypto');
const mongoose = require('mongoose');
const WorkItem = require('../models/WorkItem');
const Activity = require('../models/ActivityLog');
const Idem = require('../models/IdempotencyRecord');
const User = require('../models/User');
const { PRIORITY_RANK, ACTIVE, checkTransition } = require('./workflow');
const { access, assertTeamMember } = require('./access');
const { notFound, forbidden, conflict, badRequest, AppError } = require('../utils/errors');

const populate = (q) => q.populate('assignee', 'name email').populate('creator', 'name email').populate('team', 'name key');

function toDTO(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id, title: o.title, description: o.description, category: o.category, status: o.status,
    priority: o.priority, team: o.team, creator: o.creator, assignee: o.assignee || null,
    dueDate: o.dueDate, version: o.version, createdAt: o.createdAt, updatedAt: o.updatedAt, resolvedAt: o.resolvedAt,
  };
}
const log = (item, actor, type, data = {}) =>
  Activity.create({ workItem: item._id, actor: actor._id, type, data, versionAfter: item.version });

/** Loads an item the user may view, or throws 404 (never reveals existence of other teams' items). */
async function loadVisible(user, id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Work item not found');
  const item = await populate(WorkItem.findById(id));
  if (!item || !access(user, item).canView) throw notFound('Work item not found');
  return item;
}

async function staleConflict(id, clientVersion, fallbackMessage) {
  const current = await populate(WorkItem.findById(id));
  if (current && current.version !== clientVersion) {
    return conflict('STALE_UPDATE', 'This item was changed by someone else while you were viewing it.', {
      yourVersion: clientVersion, currentVersion: current.version, current: toDTO(current),
    });
  }
  return conflict('CONFLICT', fallbackMessage, { current: current ? toDTO(current) : null });
}

// ---------- Create (idempotent) ----------
async function createItem(user, key, input) {
  assertTeamMember(user, input.team);
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

 
  let rec;
  for (let attempt = 0; attempt < 2 && !rec; attempt++) {
    try {
      rec = await Idem.findOneAndUpdate(
        { user: user._id, key },
        { $setOnInsert: { requestHash, workItem: new mongoose.Types.ObjectId() } },
        { upsert: true, new: true }
      );
    } catch (e) { if (e.code !== 11000 || attempt === 1) throw e; }
  }
  if (rec.requestHash !== requestHash) {
    throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request body');
  }
  try {
    const created = await WorkItem.create({
      _id: rec.workItem, ...input, priorityRank: PRIORITY_RANK[input.priority || 'medium'], creator: user._id,
    });
    await log(created, user, 'created', { title: created.title, priority: created.priority });
    return { item: toDTO(await populate(WorkItem.findById(created._id))), replayed: false };
  } catch (e) {
    if (e.code === 11000) {
      const existing = await populate(WorkItem.findById(rec.workItem));
      if (existing) return { item: toDTO(existing), replayed: true };
    }
    throw e;
  }
}

// ---------- Claim (atomic) ----------
async function claimItem(user, id) {
  const item = await loadVisible(user, id);
  if (!access(user, item).canClaim) throw forbidden();
 
  const updated = await WorkItem.findOneAndUpdate(
    { _id: item._id, assignee: null, status: 'open' },
    { $set: { assignee: user._id, status: 'in_progress' }, $inc: { version: 1 } },
    { new: true }
  );
  if (!updated) {
    const current = await populate(WorkItem.findById(item._id));
    throw conflict('ALREADY_CLAIMED',
      current.assignee ? `${current.assignee.name} already took this item.` : 'This item can no longer be claimed.',
      { current: toDTO(current) });
  }
  await log(updated, user, 'claimed', { from: null, to: String(user._id) });
  return toDTO(await populate(WorkItem.findById(updated._id)));
}

// ---------- Edit (optimistic concurrency) ----------
async function updateItem(user, id, { version, ...changes }) {
  const item = await loadVisible(user, id);
  if (!access(user, item).canEdit) throw forbidden('Only the creator, assignee or a team manager can edit this item');
  if (item.status === 'closed') throw conflict('ITEM_CLOSED', 'Closed items cannot be edited', { current: toDTO(item) });
  if (item.version !== version) throw await staleConflict(item._id, version);

  const set = { ...changes };
  if (changes.priority) set.priorityRank = PRIORITY_RANK[changes.priority];
  const updated = await WorkItem.findOneAndUpdate(
    { _id: item._id, version },
    { $set: set, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) throw await staleConflict(item._id, version);

  const diff = {};
  for (const k of Object.keys(changes)) {
    const before = item[k] instanceof Date ? item[k].toISOString() : item[k];
    const after = changes[k] instanceof Date ? changes[k].toISOString() : changes[k];
    if (String(before ?? '') !== String(after ?? '')) diff[k] = k === 'description' ? { changed: true } : { from: before ?? null, to: after ?? null };
  }
  if (diff.priority) await log(updated, user, 'priority_changed', diff.priority);
  const rest = { ...diff }; delete rest.priority;
  if (Object.keys(rest).length) await log(updated, user, 'edited', rest);
  return toDTO(await populate(WorkItem.findById(updated._id)));
}

// ---------- Status ----------
async function changeStatus(user, id, { status, version }) {
  const item = await loadVisible(user, id);
  const a = access(user, item);
  const isAssignee = item.assignee && String(item.assignee._id) === String(user._id);
  if (!a.isManager && !isAssignee) throw forbidden('Only the assignee or a team manager can change status');
  if (item.version !== version) throw await staleConflict(item._id, version);
  const reason = checkTransition({ from: item.status, to: status, hasAssignee: !!item.assignee, isManager: a.isManager });
  if (reason) throw new AppError(422, 'INVALID_TRANSITION', reason, { from: item.status, to: status });

  const set = { status, resolvedAt: status === 'resolved' ? new Date() : null };
  const updated = await WorkItem.findOneAndUpdate(
    { _id: item._id, version }, { $set: set, $inc: { version: 1 } }, { new: true }
  );
  if (!updated) throw await staleConflict(item._id, version);
  await log(updated, user, 'status_changed', { from: item.status, to: status });
  return toDTO(await populate(WorkItem.findById(updated._id)));
}

// ---------- Assign (manager) ----------
async function assignItem(user, id, { assigneeId, version }) {
  const item = await loadVisible(user, id);
  if (!access(user, item).canAssign) throw forbidden('Only a team manager can assign work');
  if (item.status === 'closed') throw conflict('ITEM_CLOSED', 'Closed items cannot be reassigned', { current: toDTO(item) });
  if (item.version !== version) throw await staleConflict(item._id, version);
  if (assigneeId) {
    const target = await User.findById(assigneeId);
    if (!target || (target.role !== 'admin' && !target.teamRole(item.team._id))) {
      throw badRequest('Assignee must be a member of the item\'s team', { fields: { assigneeId: 'Not a member of this team' } });
    }
  }
  const set = { assignee: assigneeId || null };
  if (!assigneeId && item.status === 'in_progress') set.status = 'open';
  const updated = await WorkItem.findOneAndUpdate(
    { _id: item._id, version }, { $set: set, $inc: { version: 1 } }, { new: true }
  );
  if (!updated) throw await staleConflict(item._id, version);
  await log(updated, user, assigneeId ? 'assigned' : 'unassigned', {
    from: item.assignee ? String(item.assignee._id) : null, fromName: item.assignee?.name || null, to: assigneeId || null,
  });
  return toDTO(await populate(WorkItem.findById(updated._id)));
}

// ---------- List / stats ----------
function scopeFilter(user) {
  if (user.role === 'admin') return {};
  return { team: { $in: user.memberships.map((m) => m.team) } };
}

const startOfTodayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };

function buildFilter(user, q) {
  const f = scopeFilter(user);
  if (q.team) {
    const allowed = user.role === 'admin' || user.memberships.some((m) => String(m.team) === q.team);
    f.team = allowed ? new mongoose.Types.ObjectId(q.team) : { $in: [] };
  }
  if (q.status?.length) f.status = { $in: q.status };
  if (q.priority?.length) f.priority = { $in: q.priority };
  if (q.assignee === 'me') f.assignee = user._id;
  else if (q.assignee === 'unassigned') f.assignee = null;
  else if (q.assignee) f.assignee = new mongoose.Types.ObjectId(q.assignee);
  if (q.overdue) { f.dueDate = { $lt: startOfTodayUTC() }; f.status = { $in: ACTIVE }; } 
  if (q.due) {
    const n = new Date(); const start = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    f.dueDate = { $gte: start, $lt: new Date(start.getTime() + (q.due === 'today' ? 1 : 7) * 864e5) }; f.status = { $in: ACTIVE };
  }
  if (q.q) f.$text = { $search: q.q };
  return f;
}
const SORTS = {
  updated: { updatedAt: -1, _id: -1 },
  created: { createdAt: -1, _id: -1 },
  priority: { priorityRank: -1, updatedAt: -1, _id: -1 },
};

async function listItems(user, q) {
  const filter = buildFilter(user, q);
  const sort = { ...SORTS[q.sort] };
  if (q.order === 'asc') for (const k of Object.keys(sort)) sort[k] = -sort[k];
  const [items, total] = await Promise.all([
    populate(WorkItem.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit)),
    WorkItem.countDocuments(filter),
  ]);
  return { items: items.map(toDTO), page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

async function stats(user) {
  const scope = scopeFilter(user);
  const n = new Date(); const day = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const due = (days) => WorkItem.countDocuments({ ...scope, status: { $in: ACTIVE }, dueDate: { $gte: day, $lt: new Date(day.getTime() + days * 864e5) } });
  const [byStatus, mine, overdue, unassigned, dueToday, dueWeek, high] = await Promise.all([
    WorkItem.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    WorkItem.countDocuments({ ...scope, assignee: user._id, status: { $in: ACTIVE } }),
    WorkItem.countDocuments({ ...scope, dueDate: { $lt: startOfTodayUTC() }, status: { $in: ACTIVE } }),
    WorkItem.countDocuments({ ...scope, assignee: null, status: 'open' }),
    due(1), due(7),
    WorkItem.countDocuments({ ...scope, status: { $in: ACTIVE }, priority: { $in: ['high', 'critical'] } }),
  ]);
  const counts = { open: 0, in_progress: 0, blocked: 0, resolved: 0, closed: 0 };
  for (const r of byStatus) counts[r._id] = r.n;
  return { counts, mine, overdue, unassigned, dueToday, dueWeek, high };
}

module.exports = { createItem, claimItem, updateItem, changeStatus, assignItem, listItems, stats, loadVisible, toDTO, log, populate };
