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

// Icon drone
const droneIcon = L.icon({
  iconUrl: dronePng,
  iconSize: [70, 70],
  iconAnchor: [35, 35],
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

export default function RestaurantDroneTracking() {
  const { orderId } = useParams();

  const [tracking, setTracking] = useState(null);
  const [dronePos, setDronePos] = useState(null);
  const [hasArrived, setHasArrived] = useState(false);

  // Gọi API 1 lần để lấy vị trí restaurant + customer
  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `http://localhost:8000/drone/tracking/${orderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
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
    const speedMs = 150; // thời gian mỗi bước (ms) → 100 * 150ms = 15s

    const latStep = (customerPos[0] - restaurantPos[0]) / steps;
    const lngStep = (customerPos[1] - restaurantPos[1]) / steps;

    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;

      if (currentStep >= steps) {
        // Tới nơi → gắn đúng vị trí khách hàng và dừng
        setDronePos(customerPos);
        clearInterval(interval);

        // Khi drone tới nơi: dừng animation
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
    return (
      <div className="py-8 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading tracking...</p>
      </div>
    );

  const restaurantPos = [
    tracking.restaurant.latitude,
    tracking.restaurant.longitude,
  ];
  const customerPos = [tracking.customer.latitude, tracking.customer.longitude];

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-600 text-white';
      case 'accepted':
        return 'bg-yellow-500 text-black';
      case 'in-transit':
        return 'bg-purple-600 text-white';
      case 'delivered':
        return 'bg-green-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className="py-8">
      <h2 className="text-3xl font-bold mb-6">Drone Delivery Tracking</h2>

      {/* Thông tin order */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Order ID</p>
            <p className="font-semibold">#{tracking.orderId.substring(tracking.orderId.length - 6)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(tracking.orderStatus)}`}>
              {tracking.orderStatus ? tracking.orderStatus.charAt(0).toUpperCase() + tracking.orderStatus.slice(1) : 'Unknown'}
            </span>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Restaurant</p>
            <p className="font-semibold">{tracking.restaurantName || tracking.restaurantId}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Customer ID</p>
            <p className="font-semibold">{tracking.customerId}</p>
          </div>
          {tracking?.drone && (
            <div className="md:col-span-2">
              <p className="text-gray-400 text-sm">Drone</p>
              <p className="font-semibold">
                {tracking.drone.name ||
                  tracking.drone.details?.name ||
                  tracking.drone.details?.code ||
                  tracking.drone.name}{" "}
                (ID: {tracking.drone.id})
              </p>
              {hasArrived && tracking.orderStatus !== "delivered" && (
                <p className="text-yellow-500 mt-2">
                  🚁 Drone đã tới nơi, đang chờ khách hàng xác nhận
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="bg-gray-900 rounded-lg overflow-hidden" style={{ height: "600px" }}>
        <MapContainer
          center={restaurantPos}
          zoom={15}
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          {/* Marker nhà hàng */}
          <Marker position={restaurantPos} icon={restaurantIcon} />

          {/* Marker khách hàng */}
          <Marker position={customerPos} icon={customerIcon} />

          {/* Marker drone */}
          <Marker position={dronePos} icon={droneIcon} />

          {/* Đường bay */}
          <Polyline
            positions={[restaurantPos, dronePos, customerPos]}
            color="red"
          />
        </MapContainer>
      </div>
    </div>
  );
}
