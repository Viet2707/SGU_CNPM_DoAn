const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  imageUrl: String,
  restaurantId: {
    type: String, // ✅ đổi từ ObjectId -> String
    required: true,
  },
});

module.exports = mongoose.model("MenuItem", MenuItemSchema);
