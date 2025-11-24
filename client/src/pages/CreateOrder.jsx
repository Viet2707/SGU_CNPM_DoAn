import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CartContext } from "../CartContext";
import "../styles/CreateOrder.css";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  "pk_test_51S8Mu3L5S2BtEXK03ziRNt7qohq6h48nuoVTMg0ibCjD9Oee74NsEtgjUBR4q7Xj3ResfxzKXnGWWgObYJ0CEWHy00bFbGfaXl"
);

const CheckoutForm = ({
  onSuccess,
  onError,
  setLoading,
  selectedPaymentMethod,
  billingDetails,
  clientSecret,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentError, setPaymentError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || (!elements && !selectedPaymentMethod)) return;

    setLoading(true);
    try {
      const confirmParams = {
        return_url: window.location.origin,
      };

      let result;
      if (selectedPaymentMethod) {
        // For saved payment methods, only pass the payment_method ID
        result = await stripe.confirmCardPayment(
          clientSecret,
          {
            payment_method: selectedPaymentMethod,
          },
          confirmParams
        );
      } else {
        // For new payment methods, include billing_details in payment_method
        result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            ...confirmParams,
            payment_method_data: {
              billing_details: billingDetails,
            },
          },
          redirect: "if_required",
        });
      }

      const { error, paymentIntent } = result;

      if (error) {
        setPaymentError(error.message);
        onError(error);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess(paymentIntent.id);
      }
    } catch (err) {
      setPaymentError("Payment failed");
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h3 className="text-xl font-bold mb-4 text-white">Payment Details</h3>
      {paymentError && <div className="text-red-500 mb-4">{paymentError}</div>}
      <form onSubmit={handleSubmit}>
        {!selectedPaymentMethod && <PaymentElement />}
        <button
          type="submit"
          disabled={!stripe || (!elements && !selectedPaymentMethod)}
          className="w-full py-3 mt-4 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          Pay Now
        </button>
      </form>
    </div>
  );
};

const CreateOrder = () => {
  const { cart, addToCart, removeFromCart, clearCart } =
    useContext(CartContext);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [address, setAddress] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [billingDetails, setBillingDetails] = useState({
    name: "",
    email: "",
    address: { line1: "", city: "", state: "", postal_code: "", country: "US" },
  });
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");

  const navigate = useNavigate();

  useEffect(() => {
    console.log("Cart in CreateOrder:", cart);
  }, [cart]);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          "http://localhost:8000/restaurant/api/restaurants",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log("Fetched restaurants:", response.data);
        setRestaurants(response.data);
      } catch (err) {
        setError("Failed to fetch restaurants");
        console.error("Restaurant fetch error:", err);
      }
    };
    fetchRestaurants();
  }, []);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      setLoadingPaymentMethods(true);
      try {
        const token = localStorage.getItem("token");
        const email = billingDetails.email || "default@example.com";
        const name = billingDetails.name || "Default User";
        console.log("Fetching payment methods with:", { email, name });

        const response = await axios.post(
          "http://localhost:8000/payment/customer",
          { email, name },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log("Payment methods response:", response.data);

        // Ensure paymentMethods is an array
        const methods = response.data.paymentMethods || [];
        setPaymentMethods(methods);
        if (methods.length === 0) {
          console.log("No payment methods found for this customer.");
        }
      } catch (err) {
        console.error(
          "Payment methods fetch error:",
          err.response?.data || err.message
        );
        setError("Failed to load payment methods");
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    if (billingDetails.email && billingDetails.name) {
      fetchPaymentMethods();
    }
  }, [billingDetails.email, billingDetails.name]);

  useEffect(() => {
    if (!selectedRestaurant) {
      setMenuItems([]);
      return;
    }

    const fetchMenuItems = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `http://localhost:8000/restaurant/${selectedRestaurant}/menu`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log("Fetched menu items:", response.data);
        setMenuItems(response.data);
      } catch (err) {
        setError("Failed to fetch menu items");
        console.error("Menu fetch error:", err);
      }
    };
    fetchMenuItems();
  }, [selectedRestaurant]);

  const calculateTotal = () => {
    const displayedCartItems = selectedRestaurant
      ? cart.filter((item) => item.restaurantId === selectedRestaurant)
      : cart;
    return displayedCartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const getCurrentLocation = () => {
    setLoadingLocation(true);
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDeliveryLocation(coords);

        try {
          const response = await axios.get();

          if (response.data.results && response.data.results.length > 0) {
            setAddress(response.data.results[0].formatted_address);
            setBillingDetails((prev) => ({
              ...prev,
              address: {
                ...prev.address,
                line1: response.data.results[0].formatted_address,
              },
            }));
          } else {
            setAddress("Address not found");
          }
        } catch (err) {
          console.error("Geocoding error:", err);
          setAddress("Failed to get address");
        }

        setLoadingLocation(false);
      },
      (error) => {
        setError(`Failed to get location: ${error.message}`);
        setLoadingLocation(false);
      }
    );
  };

  const initiatePayment = async () => {
    if (cart.length === 0 || !selectedRestaurant) {
      setError("Cart is empty or no restaurant selected");
      return;
    }

    if (!deliveryLocation) {
      setError("Please provide your delivery location");
      return;
    }

    if (
      !billingDetails.name ||
      !billingDetails.email ||
      !billingDetails.address.line1
    ) {
      setError("Please provide complete billing details");
      return;
    }

    const orderItems = cart.filter(
      (item) => item.restaurantId === selectedRestaurant
    );
    if (orderItems.length === 0) {
      setError("No items from the selected restaurant in the cart");
      return;
    }

    const newOrderData = {
      restaurantId: selectedRestaurant,
      items: orderItems.map((item) => ({
        _id: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      total: calculateTotal(),
      deliveryLocation,
    };

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:8000/payment/create-payment-intent",
        {
          amount: newOrderData.total * 100, // Convert to cents
          currency: "usd",
          metadata: { restaurantId: newOrderData.restaurantId },
          billingDetails,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClientSecret(response.data.clientSecret);
      setOrderData(newOrderData);
      setShowPaymentModal(true);
    } catch (err) {
      setError("Failed to initialize payment");
      console.error("Payment initialization error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const orderResponse = await axios.post(
        "http://localhost:8000/order/create",
        {
          restaurantId: orderData.restaurantId,
          items: orderData.items,
          deliveryLocation: orderData.deliveryLocation,
          paymentIntentId,
          deliveryMethod,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await axios.post(
        `http://localhost:8000/payment/update/${paymentIntentId}`,
        { orderId: orderResponse.data.order._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("✅ Payment successful! Your order has been placed.");

      clearCart();
      setShowPaymentModal(false);
      navigate("/orders");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to place order");
      console.error("Order error:", err);
      alert("❌ Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentError = (err) => {
    setError(err.message || "Payment failed");
    setLoading(false);
  };

  const displayedCartItems = selectedRestaurant
    ? cart.filter((item) => item.restaurantId === selectedRestaurant)
    : cart;

  console.log("Displayed cart items:", displayedCartItems);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="create-order-header">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center px-4">
          <h1>🍔 Fastfood</h1>
          <nav className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/home")}
              className="px-4 py-2 text-white font-medium hover:underline"
            >
              Home
            </button>
          </nav>
        </div>
      </header>

      <main className="create-order-main">
        <h2 className="create-order-title">Create Order</h2>

        {error && <div className="error-alert">{error}</div>}

        <div className="create-order-grid">
          <div className="order-card">
            <h3>Select Restaurant</h3>
            <select
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              className="form-select"
            >
              <option value="">-- Select a Restaurant --</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant._id} value={restaurant._id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <h3 style={{ marginBottom: "1rem" }}>Menu Items</h3>
            {selectedRestaurant ? (
              menuItems.length > 0 ? (
                <div className="menu-grid">
                  {menuItems.map((item) => (
                    <div key={item._id} className="menu-item-card">
                      <div>
                        <h4 className="menu-item-name">{item.name}</h4>
                        <p className="menu-item-description">
                          {item.description}
                        </p>
                        <p className="menu-item-price">
                          ${item.price.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        className="btn btn-primary"
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">
                  No menu items available for this restaurant.
                </p>
              )
            ) : (
              <p className="text-gray-400">
                Please select a restaurant to view menu items.
              </p>
            )}
          </div>
        </div>

        <div className="order-card">
          <h3>Delivery Location</h3>
          <div className="delivery-section">
            <div className="delivery-input-wrapper">
              <label className="form-label">Delivery Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setBillingDetails((prev) => ({
                    ...prev,
                    address: { ...prev.address, line1: e.target.value },
                  }));
                }}
                placeholder="Enter your delivery address"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={getCurrentLocation}
              disabled={loadingLocation}
              className={`px-4 py-3 mt-4 md:mt-8 rounded bg-blue-600 text-white hover:bg-blue-700 ${
                loadingLocation ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loadingLocation ? "Getting location..." : "Use Current Location"}
            </button>
          </div>
          {deliveryLocation && (
            <div className="mt-4">
              <p className="text-green-500">✓ Location captured</p>
              <p className="text-sm text-gray-400">
                Lat: {deliveryLocation.latitude.toFixed(6)}, Lng:{" "}
                {deliveryLocation.longitude.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 bg-gray-900 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4">Billing Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-2">Full Name</label>
              <input
                type="text"
                value={billingDetails.name}
                onChange={(e) =>
                  setBillingDetails((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={billingDetails.email}
                onChange={(e) =>
                  setBillingDetails((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">City</label>
              <input
                type="text"
                value={billingDetails.address.city}
                onChange={(e) =>
                  setBillingDetails((prev) => ({
                    ...prev,
                    address: { ...prev.address, city: e.target.value },
                  }))
                }
                placeholder="Enter your city"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">State</label>
              <input
                type="text"
                value={billingDetails.address.state}
                onChange={(e) =>
                  setBillingDetails((prev) => ({
                    ...prev,
                    address: { ...prev.address, state: e.target.value },
                  }))
                }
                placeholder="Enter your state"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Postal Code</label>
              <input
                type="text"
                value={billingDetails.address.postal_code}
                onChange={(e) =>
                  setBillingDetails((prev) => ({
                    ...prev,
                    address: { ...prev.address, postal_code: e.target.value },
                  }))
                }
                placeholder="Enter your postal code"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Country</label>
              <input
                type="text"
                value={billingDetails.address.country}
                onChange={(e) =>
                  setBillingDetails((prev) => ({
                    ...prev,
                    address: { ...prev.address, country: e.target.value },
                  }))
                }
                placeholder="Enter your country"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-10 bg-gray-900 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4">Your Order</h3>
          <div className="mb-6">
            <label className="block text-gray-400 mb-2">Delivery Method</label>
            <select
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="delivery">🚚 Delivery (Người giao hàng)</option>
              <option value="drone">🚁 Drone Delivery</option>
            </select>
          </div>

          {cart.length > 0 ? (
            <>
              {displayedCartItems.length === 0 && selectedRestaurant ? (
                <p className="text-green-500 mb-4">
                  No items in the cart match the selected restaurant. Please add
                  items from this restaurant or change the selection.
                </p>
              ) : (
                <div className="mb-6">
                  {displayedCartItems.map((item) => (
                    <div
                      key={item._id}
                      className="flex justify-between items-center py-2 border-b border-gray-800"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-400">
                          ${item.price.toFixed(2)} x {item.quantity}
                        </p>
                        <p className="text-sm text-gray-400">
                          Restaurant: {item.restaurantName}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => removeFromCart(item._id)}
                          className="bg-gray-800 text-white px-3 py-1 rounded mr-2 hover:bg-gray-700"
                        >
                          -
                        </button>
                        <span className="mx-2">{item.quantity}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="bg-gray-800 text-white px-3 py-1 rounded ml-2 hover:bg-gray-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg mb-6">
                <span>Total:</span>
                <span className="text-green-500">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">
                  Payment Method
                </label>
                {loadingPaymentMethods ? (
                  <p className="text-gray-400">Loading payment methods...</p>
                ) : paymentMethods.length === 0 ? (
                  <p className="text-gray-400">
                    No saved payment methods. Add a new one below.
                  </p>
                ) : (
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Add new payment method</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.card.brand.toUpperCase()} ending in {pm.card.last4}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                onClick={initiatePayment}
                disabled={
                  loading ||
                  displayedCartItems.length === 0 ||
                  !deliveryLocation
                }
                className={`w-full py-3 px-4 rounded font-medium bg-green-500 text-white hover:bg-green-600 transition duration-200 ${
                  loading ||
                  displayedCartItems.length === 0 ||
                  !deliveryLocation
                    ? "opacity-70 cursor-not-allowed"
                    : ""
                }`}
              >
                {loading ? "Processing..." : "Proceed to Payment"}
              </button>
              {!deliveryLocation && displayedCartItems.length > 0 && (
                <p className="text-green-500 text-sm mt-2">
                  Please provide your delivery location to proceed.
                </p>
              )}
            </>
          ) : (
            <p className="text-gray-400">
              Your cart is empty. Add items from the menu to place an order.
            </p>
          )}
        </div>

        {showPaymentModal && clientSecret && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md relative">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-2 right-2 text-white hover:text-yellow-500"
              >
                ✕
              </button>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  setLoading={setLoading}
                  selectedPaymentMethod={selectedPaymentMethod}
                  billingDetails={billingDetails}
                  clientSecret={clientSecret}
                />
              </Elements>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-gray-900 text-white text-center py-4">
        <p>© {new Date().getFullYear()} Fastfood. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default CreateOrder;
