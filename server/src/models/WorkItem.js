const mongoose = require('mongoose');
const { STATUSES, PRIORITIES, CATEGORIES, PRIORITY_RANK } = require('../services/workflow');
const workItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, default: '', maxlength: 5000 },
    category: { type: String, enum: CATEGORIES, default: 'task' },
    status: { type: String, enum: STATUSES, default: 'open' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    priorityRank: { type: Number, default: PRIORITY_RANK.medium },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    version: { type: Number, default: 1 },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
workItemSchema.index({ team: 1, status: 1, updatedAt: -1 });
workItemSchema.index({ team: 1, priorityRank: -1, updatedAt: -1 });
workItemSchema.index({ assignee: 1, status: 1, updatedAt: -1 });
workItemSchema.index({ team: 1, dueDate: 1 });
workItemSchema.index({ title: 'text', description: 'text' });
module.exports = mongoose.model('WorkItem', workItemSchema);
