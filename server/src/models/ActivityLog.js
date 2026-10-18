const mongoose = require('mongoose');
// Append-only: the application never updates or deletes these records.
const s = new mongoose.Schema(
  {
    workItem: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String, required: true,
      enum: ['created', 'claimed', 'assigned', 'unassigned', 'status_changed', 'priority_changed', 'edited', 'commented'],
    },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    versionAfter: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
s.index({ workItem: 1, createdAt: -1 });
module.exports = mongoose.model('ActivityLog', s);
