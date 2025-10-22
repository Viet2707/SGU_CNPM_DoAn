const Restaurant = require('../models/restaurant');

// Create a restaurant
const createRestaurant = async (req, res) => {
  try {
    const { name, availability } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const restaurant = new Restaurant({
      name,
      availability: availability !== undefined ? availability : true,
      menu: [],
      orders: [],
    });

    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ message: `Failed to create restaurant: ${error.message}` });
  }
};

// Get all restaurants
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().populate('orders');
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: `Failed to fetch restaurants: ${error.message}` });
  }
};

// Add a menu item
const addMenuItem = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, price, description } = req.body;

    // Validate required fields
    if (!name || price == null) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    restaurant.menu.push({ name, price, description });
    await restaurant.save();
    res.status(201).json(restaurant.menu);
  } catch (error) {
    res.status(500).json({ message: `Failed to add menu item: ${error.message}` });
  }
};

// Update a menu item
const updateMenuItem = async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const { name, price, description, available } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const item = restaurant.menu.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Update only provided fields
    if (name) item.name = name;
    if (price != null) item.price = price;
    if (description) item.description = description;
    if (available !== undefined) item.available = available;

    await restaurant.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: `Failed to update menu item: ${error.message}` });
  }
};

// Delete a menu item
const deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const item = restaurant.menu.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    restaurant.menu.id(itemId).remove();
    await restaurant.save();
    res.json({ message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ message: `Failed to delete menu item: ${error.message}` });
  }
};

// Set restaurant availability
const setAvailability = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { availability } = req.body;

    // Validate availability
    if (availability === undefined) {
      return res.status(400).json({ message: 'Availability is required' });
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { availability },
      { new: true }
    );
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: `Failed to update availability: ${error.message}` });
  }
};

// Get restaurant orders
const getRestaurantOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId).populate('orders');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json(restaurant.orders);
  } catch (error) {
    res.status(500).json({ message: `Failed to fetch orders: ${error.message}` });
  }
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  setAvailability,
  getRestaurantOrders,
};