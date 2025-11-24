const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customerId: String,
  restaurantId: String,
  items: [
    {
      name: String,
      quantity: Number,
      price: Number,
    },
  ],
  total: Number,
  status: {
    type: String,
    enum: ["pending", "accepted", "in-transit", "delivered"],
    default: "pending",
  },
  deliveryPersonId: String,

  // ✅ Location cũ – giữ lại để không ảnh hưởng gì
  location: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },

  // ✅ Thêm đúng field đang dùng trong route /order/create
  deliveryLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },

  restaurantLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },

  // ✅ Thêm chọn phương thức giao
  deliveryMethod: {
    type: String,
    enum: ["delivery", "drone"],
    default: "delivery",
  },

  droneLocation: {
    latitude: Number,
    longitude: Number,
  },

  paymentIntentId: String,
});

module.exports = mongoose.model("Order", orderSchema);
