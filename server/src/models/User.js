const mongoose = require('mongoose');
const membershipSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    role: { type: String, enum: ['manager', 'member'], default: 'member' },
  },
  { _id: false }
);
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    memberships: { type: [membershipSchema], default: [] },
  },
  { timestamps: true }
);
userSchema.index({ 'memberships.team': 1 });
userSchema.methods.teamRole = function (teamId) {
  const m = this.memberships.find((x) => String(x.team) === String(teamId));
  return m ? m.role : null;
};
userSchema.methods.toPublic = function () {
  return {
    id: this._id, name: this.name, email: this.email, role: this.role,
    memberships: this.memberships.map((m) => ({ team: m.team, role: m.role })),
  };
};
module.exports = mongoose.model('User', userSchema);
