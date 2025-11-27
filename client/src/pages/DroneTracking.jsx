import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import dronePng from "../assets/icons/drone.png";
import L from "leaflet";

// ⭐ Icon nhà hàng
const restaurantIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
});

// ⭐ Icon khách hàng
const customerIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
});

// Icon drone đẹp
const droneIcon = L.icon({
  iconUrl: dronePng,
  iconSize: [70, 70], // chỉnh cho đẹp
  iconAnchor: [35, 35], // tâm icon
});

// Fix icon mặc định của Leaflet
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function DroneTracking() {
  const { orderId } = useParams();

  const [tracking, setTracking] = useState(null);
  const [dronePos, setDronePos] = useState(null);
  const [hasArrived, setHasArrived] = useState(false);

  // Gọi API 1 lần để lấy vị trí restaurant + customer
  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const res = await axios.get(
          `http://localhost:8000/drone/tracking/${orderId}`
        );
        setTracking(res.data);
        // We intentionally do not set drone position from server here —
        // the frontend animates the icon from restaurant -> customer for UX.
        // Nếu server đã báo drone tới nơi và chờ xác nhận thì set hasArrived
        if (
          res.data?.drone?.details?.waitingForCustomerConfirmation ||
          (res.data?.drone?.currentLocation?.latitude &&
            Math.abs(
              res.data.drone.currentLocation.latitude -
                res.data.customer.latitude
            ) < 0.0005 &&
            Math.abs(
              res.data.drone.currentLocation.longitude -
                res.data.customer.longitude
            ) < 0.0005)
        ) {
          setHasArrived(true);
        }
      } catch (err) {
        console.log("Fail load tracking", err);
      }
    };

    fetchTracking();
  }, [orderId]);

  // Khi đã có tracking → bắt đầu animate drone trên line
  useEffect(() => {
    if (!tracking) return;

    const restaurantPos = [
      tracking.restaurant.latitude,
      tracking.restaurant.longitude,
    ];
    const customerPos = [
      tracking.customer.latitude,
      tracking.customer.longitude,
    ];

    // Nếu đơn đã delivered thì đặt drone đứng yên ở vị trí khách và không animate
    if (tracking.orderStatus === "delivered") {
      setDronePos(customerPos);
      return;
    }

    // If the drone is already at the customer (server says waiting or currentLocation close), set to customer and don't animate
    const serverDroneLocation = tracking.drone?.currentLocation;
    const isDroneCloseToCustomer =
      serverDroneLocation &&
      Math.abs(serverDroneLocation.latitude - tracking.customer.latitude) <
        0.0005 &&
      Math.abs(serverDroneLocation.longitude - tracking.customer.longitude) <
        0.0005;

    if (
      hasArrived ||
      tracking.drone?.details?.waitingForCustomerConfirmation ||
      isDroneCloseToCustomer
    ) {
      setDronePos(customerPos);
      setHasArrived(true);
      return;
    }

    // Bắt đầu tại nhà hàng (simulate start at restaurant)
    setDronePos(restaurantPos);

    const steps = 100; // số bước bay (càng nhiều càng mượt)
    const speedMs = 150; // thời gian mỗi bước (ms) → 120 * 200ms = 24s

    const latStep = (customerPos[0] - restaurantPos[0]) / steps;
    const lngStep = (customerPos[1] - restaurantPos[1]) / steps;

    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;

      if (currentStep >= steps) {
        // Tới nơi → gắn đúng vị trí khách hàng và dừng
        setDronePos(customerPos);
        clearInterval(interval);

        // Khi drone tới nơi: dừng animation và hiện nút xác nhận cho khách hàng
        setHasArrived(true);

        return;
      }

      setDronePos((prev) => {
        const [prevLat, prevLng] = prev || restaurantPos;
        return [prevLat + latStep, prevLng + lngStep];
      });
    }, speedMs);

    return () => clearInterval(interval);
  }, [tracking, orderId, hasArrived]);

  if (!tracking || !dronePos)
    return <div style={{ color: "white" }}>Loading...</div>;

  const restaurantPos = [
    tracking.restaurant.latitude,
    tracking.restaurant.longitude,
  ];
  const customerPos = [tracking.customer.latitude, tracking.customer.longitude];

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ color: "white" }}>Drone Delivery Tracking</h2>

      {/* Thông tin order/restaurant/customer/drone */}
      <div style={{ color: "white", marginBottom: 10 }}>
        <div>
          <strong>Order Id:</strong> {tracking.orderId}
        </div>
        <div>
          <strong>Restaurant:</strong>{" "}
          {tracking.restaurantName || tracking.restaurantId} (ID:{" "}
          {tracking.restaurantId})
        </div>
        <div>
          <strong>Customer Id:</strong> {tracking.customerId}
        </div>
        {tracking?.drone && (
          <div>
            <strong>Drone:</strong>{" "}
            {tracking.drone.name ||
              tracking.drone.details?.name ||
              tracking.drone.details?.code ||
              tracking.drone.name}{" "}
            (ID: {tracking.drone.id}) — <em>{tracking.orderStatus}</em>
            {hasArrived && tracking.orderStatus !== "delivered" && (
              <span style={{ marginLeft: 12, color: "#ffd54f" }}>
                Đang chờ xác nhận của khách
              </span>
            )}
            {hasArrived && tracking.orderStatus !== "delivered" && (
              <button
                style={{
                  marginLeft: 12,
                  padding: "6px 12px",
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                onClick={async () => {
                  try {
                    await axios.patch(
                      `http://localhost:8000/order/orders/${orderId}/drone-delivered`
                    );

                    // lấy trạng thái cập nhật từ server để refresh drone state
                    const updated = await axios.get(
                      `http://localhost:8000/drone/tracking/${orderId}`
                    );
                    setTracking(updated.data);
                    setHasArrived(false);
                  } catch (err) {
                    console.error("Failed to confirm delivered:", err);
                    alert("Failed to confirm delivered. Please try again.");
                  }
                }}
              >
                Xác nhận đã giao
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ width: "100%", height: "600px" }}>
        <MapContainer
          center={restaurantPos}
          zoom={15}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          {/* 🏪 Marker nhà hàng */}
          <Marker position={restaurantPos} icon={restaurantIcon} />

          {/* 👤 Marker khách hàng */}
          <Marker position={customerPos} icon={customerIcon} />

          {/* 🚁 Marker drone với icon riêng + vị trí animate */}
          <Marker position={dronePos} icon={droneIcon} />

          {/* Đường bay: nhà hàng → drone hiện tại → khách hàng */}
          <Polyline
            positions={[restaurantPos, dronePos, customerPos]}
            color="red"
          />
        </MapContainer>
      </div>
    </div>
  );
}
