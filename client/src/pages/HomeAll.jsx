import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CartContext } from '../CartContext';
import '../styles/theme.css';

const HomeAll = () => {
  const { cart, addToCart } = useContext(CartContext);
  const [menuItems, setMenuItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [priceRange, setPriceRange] = useState(null);
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch all menu items
  useEffect(() => {
    const fetchMenuItems = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:8000/restaurant/menu/all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Fetched menu items:', response.data);
        setMenuItems(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch menu items');
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, []);

  // Update search results when searchQuery or priceRange changes
  useEffect(() => {
    let filteredItems = menuItems;

    // Filter by search query
    if (searchQuery.trim() !== '') {
      filteredItems = filteredItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by price range
    if (priceRange) {
      filteredItems = filteredItems.filter(item => {
        const price = item.price;
        return price >= priceRange.min && price <= priceRange.max;
      });
    }

    setSearchResults(filteredItems);
  }, [searchQuery, priceRange, menuItems]);

  // Handle adding item to cart
  const handleAddToCart = (item) => {
    addToCart({
      ...item,
      quantity: 1
    });
    
    // Show feedback
    const notification = document.getElementById('notification');
    if (notification) {
      notification.classList.remove('hidden');
      notification.classList.add('flex');
      setTimeout(() => {
        notification.classList.add('hidden');
        notification.classList.remove('flex');
      }, 2000);
    }
  };

  // Calculate total items in cart for badge
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Handle sign out
  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Toggle search bar
  const toggleSearchBar = () => {
    setShowSearchBar(!showSearchBar);
    if (showSearchBar) {
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // Filter menu items for display
  const getDisplayItems = () => {
    if (searchQuery.trim() !== '' || priceRange) {
      return searchResults;
    }
    return menuItems;
  };

  // Handle price range filter
  const handlePriceFilter = (min, max) => {
    if (priceRange && priceRange.min === min && priceRange.max === max) {
      // If clicking the same range, clear the filter
      setPriceRange(null);
    } else {
      setPriceRange({ min, max });
    }
  };

  // Filter for popular items (we'll consider items with lower prices as popular for demonstration)
  // const getPopularItems = () => {
  //   return [...menuItems]
  //     .sort((a, b) => a.price - b.price)
  //     .slice(0, 3);
  // };

  return (
    <div className="app-root">
      {/* Notification */}
      <div 
        id="notification" 
        className="hidden fixed top-5 right-5 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg items-center"
        style={{ zIndex: 9999 }}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        Item added to cart!
      </div>

      {/* Header - Similar to Uber Eats */}
      <header className="header">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="brand" onClick={() => navigate('/')}>
              <span className="brand-main">Fast</span>
              <span className="brand-accent">food</span>
            </h1>
          </div>

          <div className="actions">
            {/* <button
              className="flex items-center text-black px-3 py-2"
              onClick={() => navigate('/delivery-timing')}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Deliver now
            </button> */}
            
            <div className="relative">
              <button onClick={toggleSearchBar} className="flex items-center px-3 py-2">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>
            
            <div className="relative">
              <button onClick={() => navigate('/create-order')} className="flex items-center px-3 py-2">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Cart
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
            
            <button
              onClick={handleSignOut}
              className="bg-white text-black font-medium border border-gray-300 rounded-full px-4 py-2 hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Search Bar Dropdown */}
        {showSearchBar && (
          <div className="container mx-auto mt-4">
            <div className="search-bar">
              <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for restaurants, cuisines, dishes..."
                className="flex-1 bg-transparent focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="text-gray-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Price Filter Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <span className="text-gray-700 font-medium">Lọc theo giá:</span>
            <button
              onClick={() => handlePriceFilter(0, 10)}
              className={`px-4 py-2 rounded-full border transition ${
                priceRange?.min === 0 && priceRange?.max === 10
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
              }`}
            >
              $0 - $10
            </button>
            <button
              onClick={() => handlePriceFilter(10, 20)}
              className={`px-4 py-2 rounded-full border transition ${
                priceRange?.min === 10 && priceRange?.max === 20
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
              }`}
            >
              $10 - $20
            </button>
            <button
              onClick={() => handlePriceFilter(20, 30)}
              className={`px-4 py-2 rounded-full border transition ${
                priceRange?.min === 20 && priceRange?.max === 30
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
              }`}
            >
              $20 - $30
            </button>
            <button
              onClick={() => handlePriceFilter(30, 40)}
              className={`px-4 py-2 rounded-full border transition ${
                priceRange?.min === 30 && priceRange?.max === 40
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
              }`}
            >
              $30 - $40
            </button>
            {priceRange && (
              <button
                onClick={() => setPriceRange(null)}
                className="px-4 py-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500 text-white p-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading menu items...</p>
          </div>
        ) : (searchQuery || priceRange) && searchResults.length === 0 ? (
          <div className="text-center py-8 bg-gray-100 rounded-lg max-w-xl mx-auto">
            <p className="text-xl mb-4">
              {searchQuery 
                ? `Không tìm thấy món ăn cho "${searchQuery}"` 
                : `Không có món ăn trong khoảng giá $${priceRange.min} - $${priceRange.max}`
              }
            </p>
            <button 
              onClick={() => {
                setSearchQuery('');
                setPriceRange(null);
              }}
              className="text-green-500 underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <>
            {/* Search Results or Filtered Results */}
            {(searchQuery || priceRange) && (
              <div className="mb-16">
                <h2 className="text-2xl font-bold mb-4">
                  {searchQuery && priceRange 
                    ? `Kết quả tìm kiếm cho "${searchQuery}" (Giá: $${priceRange.min} - $${priceRange.max})`
                    : searchQuery 
                    ? `Kết quả tìm kiếm cho "${searchQuery}"`
                    : `Món ăn từ $${priceRange.min} - $${priceRange.max}`
                  }
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {searchResults.map(item => (
                    <div
                      key={`search-${item._id}`}
                      className="card"
                    >
                      <div className="relative">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="card-img"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/150?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className="card-img bg-gray-800 flex items-center justify-center">
                            <span className="text-gray-500">No Image</span>
                          </div>
                        )}
                      </div>
                      <div className="card-body">
                        <h3 className="text-lg font-semibold">{item.name}</h3>
                        <p className="text-gray-400 text-sm mb-3">{item.restaurantName}</p>
                        <div className="flex items-center justify-between">
                          <span className="price">${item.price.toFixed(2)}</span>
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleAddToCart(item); 
                            }}
                            className="btn-add"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Only show these sections if not searching or filtering */}
            {!searchQuery && !priceRange && (
              <>
                {/* Special Offers Section */}
                <div className="mb-16">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">Special Offers</h2>
                      {/* <p className="text-gray-600 text-sm">Provided by local restaurants</p> */}
                    </div>
                    {/* <div className="flex space-x-2">
                      <button className="bg-gray-100 rounded-full p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button className="bg-gray-100 rounded-full p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div> */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {getDisplayItems().slice(0, 6).map((item) => (
                          <div key={`special-${item._id}`} className="card">
                            <div className="relative">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="card-img" onError={(e) => { e.target.src = ''; }} />
                              ) : (
                                <div className="card-img bg-gray-800 flex items-center justify-center"><span className="text-gray-500">No Image</span></div>
                              )}
                            </div>
                            <div className="card-body">
                              <h3 className="text-lg font-semibold">{item.name}</h3>
                              <p className="text-gray-400 text-sm mb-3">{item.restaurantName}</p>
                              <div className="flex items-center justify-between">
                                <span className="price">${item.price.toFixed(2)}</span>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleAddToCart(item); 
                                  }} 
                                  className="btn-add"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>

                {/* Popular Near You Section */}
                <div className="mb-16">
                  {/* <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Popular Near You</h2>
                    <div className="flex items-center">
                      <a href="#" className="text-green-500 mr-4">View all</a>
                      <div className="flex space-x-2">
                        <button className="bg-gray-100 rounded-full p-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button className="bg-gray-100 rounded-full p-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div> */}

                  {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {getPopularItems().map((item, index) => (
                      <div
                        key={`popular-${item._id}`}
                        className="rounded-lg overflow-hidden shadow hover:shadow-md transition duration-200 cursor-pointer"
                        onClick={() => navigate(`/menu-item/${item._id}`)}
                      >
                        <div className="relative">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-48 object-cover"
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/150?text=No+Image';
                              }}
                            />
                          ) : (
                            <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400">No Image</span>
                            </div>
                          )}
                          <button 
                            className="absolute top-3 right-3 bg-white rounded-full p-1 shadow"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Favorite functionality would go here
                            }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold">{item.name}</h3>
                          <p className="text-gray-600 text-sm mb-1">
                            $$ • {item.restaurantName} • {item.category || 'Various'}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm">
                              <span className="flex items-center mr-2">
                                <svg className="w-4 h-4 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                {4.6 + (index % 3) / 10}
                              </span>
                              <span className="mr-2">{15 + (index % 4) * 5}–{30 + (index % 4) * 5} min</span>
                              <span>${item.price.toFixed(2)} fee</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(item);
                              }}
                              className="bg-green-500 text-white text-sm px-3 py-1 rounded hover:bg-green-600 transition"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div> */}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Fastfood. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomeAll;