const STATUSES = ['open', 'in_progress', 'blocked', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const CATEGORIES = ['task', 'customer_issue', 'incident', 'payment', 'compliance', 'approval', 'engineering'];
const ACTIVE = ['open', 'in_progress', 'blocked'];

const TRANSITIONS = {
  open: ['in_progress', 'blocked'],
  in_progress: ['blocked', 'resolved', 'open'],
  blocked: ['in_progress', 'open'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

/** Returns null if the transition is allowed, otherwise a human-readable reason. */
function checkTransition({ from, to, hasAssignee, isManager }) {
  if (from === to) return 'Item is already in that status';
  if (from === 'closed') return isManager && to === 'open' ? null : 'Closed items can only be reopened by a manager';
  if (!TRANSITIONS[from].includes(to)) return `Cannot move from ${from} to ${to}`;
  if ((to === 'in_progress' || to === 'resolved') && !hasAssignee) return 'Assign the item before working on or resolving it';
  if (to === 'closed' && !isManager) return 'Only a manager can close an item';
  return null;
}
module.exports = { STATUSES, PRIORITIES, PRIORITY_RANK, CATEGORIES, ACTIVE, TRANSITIONS, checkTransition };
