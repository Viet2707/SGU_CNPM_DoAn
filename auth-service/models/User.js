const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['customer', 'restaurant', 'delivery', 'admin'], required: true },
  verified: { type: Boolean, default: false }, // ✅ NEW
  isLocked: { type: Boolean, default: false }, // ✅ Account lock status
});

module.exports = mongoose.model('User', userSchema);
