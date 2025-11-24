import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/OrderHistory.css";
import { useNavigate } from "react-router-dom";

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        const user = localStorage.getItem("user");

        let endpoint = "/order/customer/orders";
        if (user === "restaurant") {
          endpoint = "/order/restaurant";
        } else if (user === "delivery") {
          endpoint = "/order/delivery";
        }

        const response = await axios.get(`http://localhost:8000${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setOrders(response.data);
      } catch (err) {
        if (err.response) {
          console.error("Response error:", err.response.data);
        } else if (err.request) {
          console.error("Request made but no response:", err.request);
        } else {
          console.error("Error:", err.message);
        }
        setError("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "status-pending";
      case "accepted":
        return "status-accepted";
      case "in-transit":
        return "status-in-transit";
      case "delivered":
        return "status-delivered";
      case "cancelled":
        return "status-cancelled";
      default:
        return "status-pending";
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div className="orders-container">
      <div className="orders-header">
        <h1 className="orders-title">Your Orders</h1>
        <p className="orders-subtitle">Track and manage all your orders</p>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p className="loading-text">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">📦 You don't have any orders yet</p>
        </div>
      ) : (
        <div className="orders-grid">
          {orders.map((order) => (
            <div key={order._id} className="order-card">
              <div className="order-card-content">
                <div className="order-header">
                  <div className="order-info">
                    <div>
                      <h3 className="order-id">
                        <span className="order-id-badge">
                          #{order._id.substring(order._id.length - 6)}
                        </span>
                        Order Details
                      </h3>
                    </div>
                    {order.createdAt && (
                      <div className="order-date">
                        {formatDate(order.createdAt)}
                      </div>
                    )}
                    {order.deliveryPersonId && (
                      <div className="order-delivery">
                        Assigned to: {order.deliveryPersonId}
                      </div>
                    )}
                  </div>
                  <span
                    className={`status-badge ${getStatusBadgeClass(
                      order.status
                    )}`}
                  >
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1)}
                  </span>
                </div>

                <div className="order-items">
                  <div className="order-items-title">Items Ordered</div>
                  {order.items.map((item, index) => (
                    <div key={index} className="order-item">
                      <div className="item-name">
                        <span className="item-quantity">{item.quantity}x</span>
                        <span>{item.name}</span>
                      </div>
                      <span className="item-price">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="order-total">
                  <span className="total-label">Total Amount</span>
                  <span className="total-amount">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
                {order.deliveryMethod === "drone" && (
                  <button
                    className="track-drone-btn"
                    onClick={() =>
                      navigate(`/orders/${order._id}/drone-tracking`)
                    }
                    style={{
                      marginTop: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#2563eb",
                      color: "white",
                      cursor: "pointer",
                      width: "100%",
                      border: "none",
                      fontWeight: "bold",
                    }}
                  >
                    🚁 Track Drone Delivery
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
