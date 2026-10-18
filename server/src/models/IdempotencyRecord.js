const mongoose = require('mongoose');
const s = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true, maxlength: 100 },
  requestHash: { type: String, required: true },
  workItem: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});
s.index({ user: 1, key: 1 }, { unique: true });
module.exports = mongoose.model('IdempotencyRecord', s);
