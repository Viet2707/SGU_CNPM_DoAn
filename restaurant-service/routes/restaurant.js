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
    
    // Fetch owner lock status from auth-service
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
    const ownerIds = restaurants.map(r => r.ownerId).filter(Boolean);
    
    let ownerLockInfo = {};
    if (ownerIds.length > 0) {
      try {
        const response = await axios.post(
          `${AUTH_SERVICE_URL}/admin/users/bulk-info`,
          { ids: ownerIds },
          { timeout: 3000 }
        );
        response.data.forEach(user => {
          ownerLockInfo[user._id] = {
            isLocked: user.isLocked || false,
            lockReason: user.lockReason || null
          };
        });
      } catch (err) {
        console.warn("Warning: Could not fetch owner lock status:", err.message);
      }
    }
    
    // Add isLocked status and lockReason to each restaurant
    const restaurantsWithLockStatus = restaurants.map(r => ({
      ...r.toObject(),
      isLocked: ownerLockInfo[r.ownerId]?.isLocked || false,
      lockReason: ownerLockInfo[r.ownerId]?.lockReason || null,
      isTemporarilyClosed: r.isTemporarilyClosed || false,
      closureReason: r.closureReason || null,
    }));
    
    res.json(restaurantsWithLockStatus);
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

    // Fetch owner lock status from auth-service
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
    const ownerIds = restaurants.map(r => r.ownerId).filter(Boolean);
    
    let lockedOwnerIds = new Set();
    if (ownerIds.length > 0) {
      try {
        const response = await axios.post(
          `${AUTH_SERVICE_URL}/admin/users/bulk-info`,
          { ids: ownerIds },
          { timeout: 3000 }
        );
        response.data.forEach(user => {
          if (user.isLocked) {
            lockedOwnerIds.add(user._id);
          }
        });
      } catch (err) {
        console.warn("Warning: Could not fetch owner lock status:", err.message);
      }
    }

    // Create map of restaurant info including lock status and closure status
    const restaurantMap = restaurants.reduce((map, restaurant) => {
      const isLocked = lockedOwnerIds.has(restaurant.ownerId);
      map[restaurant._id.toString()] = {
        name: restaurant.name,
        isLocked: isLocked,
        isTemporarilyClosed: restaurant.isTemporarilyClosed || false,
        closureReason: restaurant.closureReason || null,
      };
      return map;
    }, {});

    // Filter out menu items from locked OR temporarily closed restaurants
    const itemsWithRestaurant = menuItems
      .filter((item) => {
        const restaurantInfo = restaurantMap[item.restaurantId.toString()];
        // Hide items if restaurant is locked OR temporarily closed
        return restaurantInfo && !restaurantInfo.isLocked && !restaurantInfo.isTemporarilyClosed;
      })
      .map((item) => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        restaurantId: item.restaurantId,
        restaurantName:
          restaurantMap[item.restaurantId.toString()]?.name || "Unknown Restaurant",
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

// =============================
// LOCK/UNLOCK RESTAURANT OWNER (ADMIN ONLY)
// =============================
router.patch(
  "/admin/restaurants/:restaurantId/lock",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { isLocked } = req.body;

      console.log(`🔒 Admin attempting to ${isLocked ? 'lock' : 'unlock'} restaurant:`, restaurantId);

      // Check if restaurant exists
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: "Nhà hàng không tồn tại" });
      }

      // Nếu đang khóa (isLocked = true), kiểm tra đơn hàng pending
      if (isLocked) {
        const ORDER_SERVICE_URL =
          process.env.ORDER_SERVICE_URL || "http://order-service:5003";
        
        try {
          const pendingCheckResponse = await axios.get(
            `${ORDER_SERVICE_URL}/admin/restaurant/${restaurantId}/has-pending-orders`,
            {
              headers: { Authorization: req.headers.authorization },
            }
          );

          if (pendingCheckResponse.data.hasPendingOrders) {
            return res.status(400).json({
              message: `Không thể khóa nhà hàng vì còn ${pendingCheckResponse.data.pendingOrderCount} đơn hàng chưa giao xong`,
              pendingOrderCount: pendingCheckResponse.data.pendingOrderCount,
            });
          }
        } catch (err) {
          console.error("Error checking pending orders:", err.message);
          return res.status(500).json({
            message: "Không thể kiểm tra đơn hàng đang chờ của nhà hàng",
          });
        }
      }

      // Lock/unlock the owner account via auth-service
      const AUTH_SERVICE_URL =
        process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
      
      try {
        await axios.patch(
          `${AUTH_SERVICE_URL}/admin/users/${restaurant.ownerId}/lock`,
          { isLocked, reason: req.body.reason },
          {
            headers: { Authorization: req.headers.authorization },
          }
        );
        console.log(`✅ ${isLocked ? 'Locked' : 'Unlocked'} owner account:`, restaurant.ownerId);
      } catch (err) {
        console.error("Error locking/unlocking owner account:", err.message);
        return res.status(500).json({
          message: "Không thể khóa/mở khóa tài khoản owner",
        });
      }

      return res.json({
        message: `${isLocked ? 'Khóa' : 'Mở khóa'} nhà hàng thành công`,
        isLocked,
      });
    } catch (err) {
      console.error("❌ Lock/unlock restaurant error:", err.message);
      res.status(500).json({ message: "Lỗi server khi khóa/mở khóa nhà hàng" });
    }
  }
);

// =============================
// TOGGLE TEMPORARY CLOSURE (RESTAURANT OWNER)
// =============================
router.patch(
  "/toggle-closure",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const ownerId = req.user.id;
      const { isTemporarilyClosed, reason } = req.body;

      console.log(`🏪 Restaurant owner ${ownerId} toggling closure to:`, isTemporarilyClosed);

      const restaurant = await Restaurant.findOne({ ownerId });
      if (!restaurant) {
        return res.status(404).json({ message: "Nhà hàng không tồn tại" });
      }

      // Nếu đang đóng cửa (isTemporarilyClosed = true), kiểm tra đơn hàng pending
      if (isTemporarilyClosed) {
        const ORDER_SERVICE_URL =
          process.env.ORDER_SERVICE_URL || "http://order-service:5003";
        
        try {
          const pendingCheckResponse = await axios.get(
            `${ORDER_SERVICE_URL}/admin/restaurant/${restaurant._id}/has-pending-orders`,
            {
              headers: { Authorization: req.headers.authorization },
            }
          );

          if (pendingCheckResponse.data.hasPendingOrders) {
            return res.status(400).json({
              message: `Không thể đóng cửa vì còn ${pendingCheckResponse.data.pendingOrderCount} đơn hàng chưa giao xong`,
              pendingOrderCount: pendingCheckResponse.data.pendingOrderCount,
            });
          }
        } catch (err) {
          console.error("Error checking pending orders:", err.message);
          return res.status(500).json({
            message: "Không thể kiểm tra đơn hàng đang chờ",
          });
        }
      }

      restaurant.isTemporarilyClosed = isTemporarilyClosed;
      restaurant.closureReason = isTemporarilyClosed ? (reason || "Tạm thời đóng cửa") : null;
      await restaurant.save();

      console.log(`✅ Restaurant ${restaurant._id} ${isTemporarilyClosed ? 'closed' : 'opened'} temporarily`);

      return res.json({
        message: `Nhà hàng đã ${isTemporarilyClosed ? 'đóng cửa' : 'mở cửa'} thành công`,
        isTemporarilyClosed: restaurant.isTemporarilyClosed,
        closureReason: restaurant.closureReason
      });
    } catch (err) {
      console.error("❌ Toggle closure error:", err.message);
      res.status(500).json({ message: "Lỗi server khi thay đổi trạng thái" });
    }
  }
);

// =============================
// REQUEST PERMANENT CLOSURE (RESTAURANT OWNER)
// =============================
router.post(
  "/request-permanent-closure",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const ownerId = req.user.id;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Vui lòng nhập lý do đóng tài khoản" });
      }

      console.log(`🏪 Restaurant owner ${ownerId} requesting permanent closure`);

      const restaurant = await Restaurant.findOne({ ownerId });
      if (!restaurant) {
        return res.status(404).json({ message: "Nhà hàng không tồn tại" });
      }

      // Kiểm tra xem đã có yêu cầu pending chưa
      const hasPendingRequest = restaurant.closureRequests?.some(
        req => req.status === 'pending'
      );

      if (hasPendingRequest) {
        return res.status(400).json({ 
          message: "Bạn đã có yêu cầu đóng tài khoản đang chờ xử lý" 
        });
      }

      // Thêm yêu cầu mới
      if (!restaurant.closureRequests) {
        restaurant.closureRequests = [];
      }

      restaurant.closureRequests.push({
        requestType: 'permanent_closure',
        reason: reason.trim(),
        status: 'pending',
        requestedAt: new Date()
      });

      await restaurant.save();

      console.log(`✅ Permanent closure request created for restaurant ${restaurant._id}`);

      return res.json({
        message: "Yêu cầu đóng tài khoản đã được gửi. Admin sẽ xem xét trong thời gian sớm nhất.",
        request: restaurant.closureRequests[restaurant.closureRequests.length - 1]
      });
    } catch (err) {
      console.error("❌ Request permanent closure error:", err.message);
      res.status(500).json({ message: "Lỗi server khi gửi yêu cầu" });
    }
  }
);

// =============================
// GET RESTAURANT STATUS (RESTAURANT OWNER)
// =============================
router.get(
  "/my-status",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const ownerId = req.user.id;

      const restaurant = await Restaurant.findOne({ ownerId });
      if (!restaurant) {
        return res.status(404).json({ message: "Nhà hàng không tồn tại" });
      }

      // Get owner lock status
      const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
      let isLocked = false;
      let lockReason = null;

      try {
        const response = await axios.post(
          `${AUTH_SERVICE_URL}/admin/users/bulk-info`,
          { ids: [ownerId] },
          { timeout: 3000 }
        );
        if (response.data && response.data.length > 0) {
          isLocked = response.data[0].isLocked || false;
          lockReason = response.data[0].lockReason || null;
        }
      } catch (err) {
        console.warn("Warning: Could not fetch owner lock status:", err.message);
      }

      // Get pending closure request
      const pendingRequest = restaurant.closureRequests?.find(
        req => req.status === 'pending'
      );

      return res.json({
        restaurantId: restaurant._id,
        name: restaurant.name,
        isTemporarilyClosed: restaurant.isTemporarilyClosed,
        closureReason: restaurant.closureReason,
        isLocked,
        lockReason,
        hasPendingClosureRequest: !!pendingRequest,
        pendingClosureRequest: pendingRequest || null
      });
    } catch (err) {
      console.error("❌ Get restaurant status error:", err.message);
      res.status(500).json({ message: "Lỗi server khi lấy thông tin" });
    }
  }
);

module.exports = router;
