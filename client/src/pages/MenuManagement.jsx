import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const MenuManagement = () => {
  const [menuItem, setMenuItem] = useState({
    name: '',
    description: '',
    price: ''
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMenuItem({
      ...menuItem,
      [name]: value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file)); // Create preview URL
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('name', menuItem.name);
      formData.append('description', menuItem.description);
      formData.append('price', parseFloat(menuItem.price));
      if (image) {
        formData.append('image', image);
      }

      const response = await axios.post('http://localhost:5020/restaurant/menu', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Menu item added:', response.data); // Debug: Log response
      setSuccess('Menu item added successfully!');
      setMenuItem({ name: '', description: '', price: '' });
      setImage(null);
      setImagePreview(null);

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add menu item');
      console.error('Add menu item error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="bg-yellow-500 text-black p-4 shadow-md">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">FoodDelivery</h1>
          <nav className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/restaurant/menu')}
              className="px-4 py-2 text-black font-medium hover:underline"
            >
              View Menu
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-black font-medium hover:underline"
            >
              Home
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-md mx-auto bg-gray-900 rounded-lg shadow-lg p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Add Menu Item</h2>

          {error && (
            <div className="bg-red-500 text-white p-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500 text-white p-3 rounded mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Item Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={menuItem.name}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
                placeholder="e.g. Margherita Pizza"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={menuItem.description}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
                placeholder="Describe your dish"
              ></textarea>
            </div>

            <div className="mb-4">
              <label htmlFor="price" className="block text-sm font-medium mb-2">
                Price ($)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={menuItem.price}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
                placeholder="9.99"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="image" className="block text-sm font-medium mb-2">
                Item Image
              </label>
              <input
                type="file"
                id="image"
                name="image"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageChange}
                className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              {imagePreview && (
                <div className="mt-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded font-medium bg-yellow-500 text-black hover:bg-yellow-600 transition duration-200 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Adding...' : 'Add Menu Item'}
            </button>
          </form>
        </div>
      </main>

      <footer className="bg-gray-900 text-white text-center py-4">
        <p>© {new Date().getFullYear()} FoodDelivery. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default MenuManagement;