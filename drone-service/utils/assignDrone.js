const axios = require("axios");
const Drone = require("../models/Drone");
const { publishEvent } = require("../rabbitmq");

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:5003";

// small helper to move towards target
function moveTowards(current, target, step = 0.002) {
  const dx = target.latitude - current.latitude;
  const dy = target.longitude - current.longitude;

  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < step) return target; // nearly there

  return {
    latitude: current.latitude + (dx / distance) * step,
    longitude: current.longitude + (dy / distance) * step,
  };
}

async function assignDroneToOrder(drone, order, options = {}) {
  try {
    // Use the documents (drone is mongoose doc; order is plain object)
    const restaurant = order.restaurantLocation;
    const customer = order.deliveryLocation;

    if (!restaurant || !customer) {
      console.error("Missing restaurant or customer location");
      return false;
    }

    // Update drone status
    drone.status = "in-transit";
    drone.assignedOrderId = order._id;
    drone.currentLocation = drone.baseLocation || {
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    };
    await drone.save();

    // Notify order-service
    try {
      const resp = await axios.patch(
        `${ORDER_SERVICE_URL}/orders/${order._id}/assign-drone`,
        {
          droneId: drone._id,
          drone: {
            droneId: drone._id,
            code: drone.code,
            name: drone.name,
            batteryPercent: drone.batteryPercent,
            currentLocation: drone.currentLocation,
          },
        }
      );
      if (resp.status === 409) {
        console.warn("Order already assigned by another drone:", order._id);
        // mark drone idle again so it can try another
        drone.status = "idle";
        drone.assignedOrderId = null;
        await drone.save();
        return false;
      }
    } catch (err) {
      if (err?.response?.status === 409) {
        console.warn("Order already assigned by another drone:", order._id);
        drone.status = "idle";
        drone.assignedOrderId = null;
        await drone.save();
        return false;
      }

      console.error(
        "Failed to notify order-service about assigned drone:",
        err.message
      );
    }

    // Publish event to mark in-transit
    try {
      await publishEvent("delivery.in_transit", {
        orderId: order._id,
        status: "in-transit",
      });
    } catch (err) {
      // not fatal
    }

    // Movement loop
    let dronePos = {
      latitude: drone.currentLocation.latitude,
      longitude: drone.currentLocation.longitude,
    };

    const interval = setInterval(async () => {
      try {
        dronePos = moveTowards(dronePos, customer);
        drone.currentLocation = {
          latitude: dronePos.latitude,
          longitude: dronePos.longitude,
        };
        await drone.save();

        // Update order-service with drone location
        await axios.patch(
          `${ORDER_SERVICE_URL}/orders/${order._id}/drone-location`,
          {
            latitude: dronePos.latitude,
            longitude: dronePos.longitude,
            droneId: drone._id,
          }
        );

        // if arrived (eps threshold)
        if (
          Math.abs(dronePos.latitude - customer.latitude) < 0.0005 &&
          Math.abs(dronePos.longitude - customer.longitude) < 0.0005
        ) {
          clearInterval(interval);
          // waiting for customer confirmation
          drone.waitingForCustomerConfirmation = true;
          await drone.save();
          console.log(
            "Drone arrived and waiting for customer confirmation",
            order._id
          );
        }
      } catch (err) {
        console.error("Error while moving drone:", err.message);
      }
    }, 1000);

    return true;
  } catch (err) {
    console.error("assignDroneToOrder error:", err.message);
    return false;
  }
}

module.exports = {
  assignDroneToOrder,
};
