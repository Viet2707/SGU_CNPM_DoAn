const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: String,
  ownerId: String, // from Auth user ID
  isOpen: Boolean,
});

module.exports = mongoose.model('Restaurant', restaurantSchema);
