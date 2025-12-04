const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: String,
  ownerId: String, // from Auth user ID
  isOpen: Boolean,
  isTemporarilyClosed: { type: Boolean, default: false }, // ✅ Nhà hàng tự tạm đóng cửa
  closureReason: String, // ✅ Lý do tạm đóng
  closureRequests: [{ // ✅ Lịch sử yêu cầu đóng tài khoản vĩnh viễn
    requestType: { type: String, enum: ['permanent_closure'] },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    reviewedBy: String, // Admin ID
    reviewedAt: Date,
    reviewNote: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
