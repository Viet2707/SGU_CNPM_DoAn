import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/theme.css';

const DeliveryAdminPanel = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:8000/delivery/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Fetched orders:', response.data);
        // Debug: Check if location data exists
        if (response.data.length > 0) {
          console.log('First order details:', response.data[0]);
          console.log('Location data available?', !!response.data[0].location);
        }
        
        // Option 1: Use the data as is (if backend is properly sending location)
        setOrders(response.data);
        
        // Option 2: Uncomment to add dummy location data for testing
        /*
        const ordersWithLocation = response.data.map(order => ({
          ...order,
          location: order.location || {
            address: "123 Test Street, City, Country",
            coordinates: {
              lat: 37.7749,
              lng: -122.4194
            }
          }
        }));
        setOrders(ordersWithLocation);
        */
      } catch (err) {
        console.error('Error fetching orders:', err.message);
        setError('Failed to fetch delivery orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleClaimOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `http://localhost:8000/delivery/order/${orderId}`,
        { status: 'in-transit' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Claim order response:', response.data);

      setOrders(orders.map(order =>
        order._id === orderId ? { ...order, status: 'in-transit', deliveryPersonId: response.data.order?.deliveryPersonId || 'assigned', deliveryPersonName: response.data.order?.deliveryPersonName } : order
      ));
      setError('');
    } catch (err) {
      console.error('Error claiming order:', err.message);
      setError('Failed to claim order');
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `http://localhost:8000/delivery/order/${orderId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Status update response:', response.data);

      setOrders(orders.map(order =>
        order._id === orderId ? { ...order, status: newStatus } : order
      ));
      setError('');
    } catch (err) {
      console.error('Error updating status:', err.message);
      setError('Failed to update order status');
    }
  };

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  

  return (
    <div className="app-root py-8">
      <div className="container mx-auto">
        <h1 className="orders-title">Delivery Admin Panel</h1>

      {error && (
        <div className="bg-red-500 text-white p-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <p className="text-xl">No available or assigned orders.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order._id} className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
              <div className="p-6">
                {/* Debug information - uncomment if needed */}
                {/*
                <div className="bg-red-800 p-2 mb-4 text-xs">
                  <p>Order ID: {order._id}</p>
                  <p>Has location object: {order.location ? "Yes" : "No"}</p>
                  <p>Location data: {JSON.stringify(order.location)}</p>
                </div>
                */}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">Order #{order._id.substring(order._id.length - 6)}</h3>
                    {order.createdAt && (
                      <p className="text-gray-400 text-sm">
                        {formatDate(order.createdAt)}
                      </p>
                    )}
                    <p className="text-gray-400 text-sm">
                      Status: {order.status || 'Unknown'}
                    </p>
                    {order.deliveryPersonName ? (
                      <p className="text-gray-400 text-sm">Assigned to: {order.deliveryPersonName}</p>
                    ) : order.deliveryPersonId ? (
                      <p className="text-gray-400 text-sm">Assigned to: Unnamed Delivery Person</p>
                    ) : null}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(order.status)}`}>
                    {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                  </span>
                </div>

                {/* Delivery location intentionally hidden when not provided */}

                <div className="space-y-2 mb-4">
                  <h4 className="font-medium text-green-500 mb-2">Order Items</h4>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, index) => (
                      <div key={index} className="flex justify-between py-1 border-b border-gray-800">
                        <span>{item.quantity}x {item.name}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400">No items available</p>
                  )}
                </div>

                <div className="border-t border-gray-800 pt-4 flex flex-col sm:flex-row justify-between items-center">
                  <div className="space-x-2 mb-4 sm:mb-0 w-full sm:w-auto">
                    {order.status === 'accepted' && !order.deliveryPersonId ? (
                      <button
                        onClick={() => handleClaimOrder(order._id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full sm:w-auto"
                      >
                        Claim Order
                      </button>
                    ) : order.status === 'accepted' ? (
                      <p className="text-gray-400 text-sm">Order already assigned</p>
                    ) : null}

                    {order.status === 'in-transit' ? (
                      <button
                        onClick={() => handleStatusUpdate(order._id, 'delivered')}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full sm:w-auto"
                      >
                        Mark as Delivered
                      </button>
                    ) : order.status !== 'accepted' && order.status !== 'in-transit' ? (
                      <p className="text-gray-400 text-sm">No actions available</p>
                    ) : null}
                  </div>
                  <div className="font-bold">
                    <span>Total: </span>
                    <span className="price">${order.total ? order.total.toFixed(2) : '0.00'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default DeliveryAdminPanel;