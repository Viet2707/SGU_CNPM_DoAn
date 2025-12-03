const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");
const { v2: cloudinary } = require("cloudinary");
const { publishEvent } = require("../rabbitmq");   // <-- RABBITMQ

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =============================
// GET ALL RESTAURANTS
// =============================
router.get("/api/restaurants", async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (err) {
    console.error("Error fetching restaurants:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================
// GET RESTAURANTS BY OWNER
// =============================
router.get("/api/restaurants-id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const restaurants = await Restaurant.find({ ownerId: userId });
    res.json(restaurants);
  } catch (error) {
    console.error("Error fetching restaurant IDs:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================
// GET MENU BY RESTAURANT
// =============================
router.get("/:restaurantId/menu", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log("📥 Fetching menu for restaurant:", restaurantId);

    const menuItems = await MenuItem.find({ restaurantId });
    console.log("✅ Found menu items:", menuItems);
    res.json(menuItems);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================
// CREATE RESTAURANT PROFILE
// =============================
router.post(
  "/profile",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const { name } = req.body;
      const restaurant = new Restaurant({
        name,
        ownerId: req.user.id,
        isOpen: true,
      });
      await restaurant.save();
      res.send({ message: "Restaurant profile created", restaurant });
    } catch (err) {
      console.error("Error in /restaurant/profile:", err);
      res.status(500).send({ message: "Internal server error" });
    }
  }
);

// =============================
// ADD MENU ITEM (WITH IMAGE)
// =============================
router.post(
  "/menu",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      console.log("Logged-in user ID:", userId);

      const restaurant = await Restaurant.findOne({ ownerId: userId });
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { name, description, price } = req.body;
      let imageUrl;

      if (req.files && req.files.image) {
        const file = req.files.image;
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        if (!mimetype) {
          return res
            .status(400)
            .json({ message: "Only JPEG/JPG/PNG images are allowed" });
        }

        const result = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: "food-delivery/menu",
          resource_type: "image",
        });
        imageUrl = result.secure_url;
        console.log("Cloudinary upload result:", result.secure_url);
      }

      const item = new MenuItem({
        name,
        description,
        price: parseFloat(price),
        restaurantId: restaurant._id,
        imageUrl,
      });
      await item.save();

      res.send({ message: "Menu item added", item });
    } catch (err) {
      console.error("Error in /restaurant/menu:", err);
      res.status(500).send({ message: err.message || "Internal server error" });
    }
  }
);

// =============================
// GET OWN MENU ITEMS
// =============================
router.get("/menu", verifyToken, allowRoles("restaurant"), async (req, res) => {
  try {
    const userId = req.user.id;

    const restaurants = await Restaurant.find({ ownerId: userId });
    const restaurantIds = restaurants.map((restaurant) => restaurant._id);

    const items = await MenuItem.find({
      restaurantId: { $in: restaurantIds },
    });

    res.send(items);
  } catch (err) {
    console.error("Error in /restaurant/menu GET:", err);
    res.status(500).send({ message: "Internal server error" });
  }
});

// =============================
// DELETE MENU ITEM
// =============================
router.delete(
  "/menu/:id",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      await MenuItem.findByIdAndDelete(req.params.id);
      res.send({ message: "Menu item deleted" });
    } catch (err) {
      console.error("Error in /restaurant/menu/:id DELETE:", err);
      res.status(500).send({ message: "Internal server error" });
    }
  }
);

// =============================
// GET MENU WITH RESTAURANT NAME
// =============================
router.get("/menu/all", verifyToken, async (req, res) => {
  try {
    const menuItems = await MenuItem.find();

    const restaurantIds = [
      ...new Set(menuItems.map((item) => item.restaurantId.toString())),
    ];

    const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } });

    const restaurantMap = restaurants.reduce((map, restaurant) => {
      map[restaurant._id.toString()] = restaurant.name;
      return map;
    }, {});

    const itemsWithRestaurant = menuItems.map((item) => ({
      _id: item._id,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      restaurantId: item.restaurantId,
      restaurantName:
        restaurantMap[item.restaurantId.toString()] || "Unknown Restaurant",
    }));

    res.json(itemsWithRestaurant);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================
// ACCEPT ORDER + PUBLISH EVENT
// =============================
router.post(
  "/accept-order",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const { orderId } = req.body;
      const ownerId = req.user.id;

      console.log("🍽 Accepting order:", orderId);

      const restaurant = await Restaurant.findOne({ ownerId });
      if (!restaurant) {
        return res.status(403).json({ message: "You do not own a restaurant" });
      }

      const ORDER_SERVICE_URL =
        process.env.ORDER_SERVICE_URL || "http://order-service:5003";

      const response = await axios.post(
        `${ORDER_SERVICE_URL}/restaurant/accept`,
        { orderId }
      );

      const order = response.data.order;

      // PUBLISH EVENT
      await publishEvent("order.accepted", {
        orderId: order._id,
        restaurantId: order.restaurantId,
        customerId: order.customerId,
        items: order.items,
        total: order.total,
        deliveryLocation: order.deliveryLocation,
      });

      console.log("✅ Published order.accepted");

      return res.json({
        message: "Order accepted",
        eventSent: true,
        order,
      });
    } catch (err) {
      console.error("❌ Accept order error:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// =============================
// DELETE RESTAURANT (ADMIN ONLY)
// =============================
router.delete(
  "/admin/restaurants/:restaurantId",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { restaurantId } = req.params;

      console.log("🗑️ Admin attempting to delete restaurant:", restaurantId);

      // Check if restaurant exists
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: "Nhà hàng không tồn tại" });
      }

      // Check if restaurant has any orders
      const ORDER_SERVICE_URL =
        process.env.ORDER_SERVICE_URL || "http://order-service:5003";
      
      try {
        const orderCheckResponse = await axios.get(
          `${ORDER_SERVICE_URL}/admin/restaurant/${restaurantId}/has-orders`,
          {
            headers: { Authorization: req.headers.authorization },
          }
        );

        if (orderCheckResponse.data.hasOrders) {
          return res.status(400).json({
            message: "Không thể xóa nhà hàng này vì đã có đơn hàng",
          });
        }
      } catch (err) {
        console.error("Error checking orders:", err.message);
        return res.status(500).json({
          message: "Không thể kiểm tra đơn hàng của nhà hàng",
        });
      }

      // Delete all menu items of this restaurant
      await MenuItem.deleteMany({ restaurantId });
      console.log("✅ Deleted menu items for restaurant:", restaurantId);

      // Delete the restaurant
      await Restaurant.findByIdAndDelete(restaurantId);
      console.log("✅ Deleted restaurant:", restaurantId);

      // Delete the owner account from auth-service
      const AUTH_SERVICE_URL =
        process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
      
      try {
        await axios.delete(
          `${AUTH_SERVICE_URL}/admin/users/${restaurant.ownerId}`,
          {
            headers: { Authorization: req.headers.authorization },
          }
        );
        console.log("✅ Deleted owner account:", restaurant.ownerId);
      } catch (err) {
        console.warn("Warning: Could not delete owner account:", err.message);
      }

      return res.json({
        message: "Xóa nhà hàng thành công",
      });
    } catch (err) {
      console.error("❌ Delete restaurant error:", err.message);
      res.status(500).json({ message: "Lỗi server khi xóa nhà hàng" });
    }
  }
);

module.exports = router;
