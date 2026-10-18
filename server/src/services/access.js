const { forbidden } = require('../utils/errors');

/** Resource-level permissions, derived from (user, item.team) on every request. */
function access(user, item) {
  const admin = user.role === 'admin';
  const teamId = item.team._id || item.team;
  const teamRole = user.teamRole(teamId);
  const isMember = admin || !!teamRole;
  const isManager = admin || teamRole === 'manager';
  const uid = String(user._id);
  const involved = String(item.creator._id || item.creator) === uid ||
    (item.assignee && String(item.assignee._id || item.assignee) === uid);
  return {
    isMember, isManager,
    canView: isMember,
    canEdit: isMember && (isManager || involved),
    canAssign: isManager,
    canClaim: isMember,
    canComment: isMember,
  };
}
function assertTeamMember(user, teamId) {
  if (user.role === 'admin' || user.teamRole(teamId)) return;
  throw forbidden('You are not a member of that team');
}
module.exports = { access, assertTeamMember };
