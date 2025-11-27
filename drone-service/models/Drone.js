const mongoose = require("mongoose");

const droneSchema = new mongoose.Schema(
  {
    code: String,
    name: String,
    status: {
      type: String,
      enum: ["idle", "in-transit", "offline", "maintenance"],
      default: "idle",
    },
    isActive: { type: Boolean, default: true },
    capacityKg: { type: Number, default: 5 },
    batteryPercent: { type: Number, default: 100 },
    currentLocation: {
      latitude: Number,
      longitude: Number,
    },
    baseLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    assignedOrderId: { type: String, default: null },
    // When drone arrives at customer and waits for customer confirmation
    waitingForCustomerConfirmation: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Drone", droneSchema);
