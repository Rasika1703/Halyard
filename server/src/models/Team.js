const mongoose = require('mongoose');
module.exports = mongoose.model('Team', new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    key: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 6 },
  },
  { timestamps: true }
));
