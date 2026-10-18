const mongoose = require('mongoose');
const s = new mongoose.Schema(
  {
    workItem: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: true }
);
s.index({ workItem: 1, createdAt: -1 });
module.exports = mongoose.model('Comment', s);
