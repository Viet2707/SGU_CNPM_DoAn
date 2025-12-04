const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['customer', 'restaurant', 'delivery', 'admin'], required: true },
  verified: { type: Boolean, default: false }, // ✅ NEW
  isLocked: { type: Boolean, default: false }, // ✅ Account lock status
  lockReason: { type: String }, // ✅ Lý do khóa tài khoản
  lockHistory: [{ // ✅ Lịch sử khóa/mở khóa
    action: { type: String, enum: ['locked', 'unlocked'] },
    reason: String,
    adminId: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
