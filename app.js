import React, { useState, useEffect } from 'react';
import { RefreshCw, LogOut, Calendar, CheckCircle, XCircle, Trash2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

const App = () => {
  const [user, setUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize Facebook SDK
  useEffect(() => {
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: process.env.REACT_APP_FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });
    };

    // Load Facebook SDK
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }, []);

  // Login with Facebook
  const loginWithFacebook = () => {
    setLoading(true);
    window.FB.login(async (response) => {
      if (response.authResponse) {
        try {
          const result = await fetch(`${API_BASE_URL}/auth/facebook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accessToken: response.authResponse.accessToken,
              userID: response.authResponse.userID
            }),
          });

          const data = await result.json();
          
          if (data.success) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            fetchPages(data.user.id);
          } else {
            setError('Đăng nhập thất bại');
          }
        } catch (err) {
          console.error('Login error:', err);
          setError('Lỗi kết nối server');
        }
      } else {
        setError('Đăng nhập Facebook thất bại');
      }
      setLoading(false);
    }, { scope: 'pages_manage_posts,pages_read_engagement,pages_manage_metadata,pages_read_user_content,pages_manage_engagement,pages_utility_messaging,public_profile' });
  };

  // Fetch pages
  const fetchPages = async (userId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/pages/${userId}`);
      const data = await response.json();
      
      if (data.pages) {
        setPages(data.pages);
      } else {
        setError('Không thể tải danh sách trang');
      }
    } catch (err) {
      console.error('Fetch pages error:', err);
      setError('Lỗi kết nối server');
    }
    setLoading(false);
  };

  // Renew token
  const renewToken = async (pageId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/pages/${pageId}/renew-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the page in the list
        setPages(pages.map(page => 
          page.pageId === pageId ? data.page : page
        ));
        setError('');
      } else {
        setError('Không thể làm mới token');
      }
    } catch (err) {
      console.error('Renew token error:', err);
      setError('Lỗi kết nối server');
    }
    setLoading(false);
  };

  // Delete page
  const deletePage = async (pageId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa trang này?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/pages/${pageId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setPages(pages.filter(page => page.pageId !== pageId));
        setError('');
      } else {
        setError('Không thể xóa trang');
      }
    } catch (err) {
      console.error('Delete page error:', err);
      setError('Lỗi kết nối server');
    }
    setLoading(false);
  };

  // Logout
  const logout = () => {
    setUser(null);
    setPages([]);
    localStorage.removeItem('user');
    window.FB.logout();
  };

  // Check localStorage for saved user
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      fetchPages(userData.id);
    }
  }, []);

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
            Quản lý Trang Facebook
          </h1>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <button
            onClick={loginWithFacebook}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập với Facebook'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Quản lý Trang Facebook
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">Xin chào, {user.name}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => fetchPages(user.id)}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới danh sách
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <div key={page.pageId} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {page.pageName}
                  </h3>
                  <p className="text-sm text-gray-600 mb-1">
                    ID: {page.pageId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {page.isExpired ? (
                    <XCircle className="w-6 h-6 text-red-500" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">
                    Hết hạn: {formatDate(page.tokenExpiry)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Trạng thái:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    page.isExpired 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {page.isExpired ? 'Đã hết hạn' : 'Đang hoạt động'}
                  </span>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => renewToken(page.pageId)}
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới Token
                  </button>
                  <button
                    onClick={() => deletePage(page.pageId)}
                    disabled={loading}
                    className="bg-red-600 text-white py-2 px-3 rounded text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {pages.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Chưa có trang nào được tải. Nhấn "Làm mới danh sách" để tải các trang Facebook của bạn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;