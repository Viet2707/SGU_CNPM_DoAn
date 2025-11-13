import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/theme.css';

const RestaurantProfile = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post('http://localhost:8000/restaurant/profile', 
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.restaurant) {
        localStorage.setItem('restaurantId', response.data.restaurant._id);
        navigate('/restaurant/menu');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create restaurant profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-root">
      <header className="header">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="brand" onClick={() => navigate('/')}>
            <span className="brand-main">Fast</span>
            <span className="brand-accent">food</span>
          </h1>
          <nav className="actions">
            <button onClick={() => navigate('/')} className="px-4 py-2 hover:underline">Home</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-md mx-auto bg-gray-900 rounded-lg shadow-lg p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Create Restaurant Profile</h2>
          
          {error && (
            <div className="bg-red-500 text-white p-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Restaurant Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                required
                placeholder="Enter your restaurant name"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded font-medium btn-add ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Creating...' : 'Create Restaurant'}
            </button>
          </form>
        </div>
      </main>
      
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Fastfood. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default RestaurantProfile;