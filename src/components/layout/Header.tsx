import React, { useState, useEffect } from 'react';
import { Bell, Search, Settings, LogOut, User, Menu, Crown, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useStripeSubscription } from '../../hooks/useStripeSubscription';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { stripeProducts } from '../../stripe-config';
import { formatTimeAgo } from '../../utils/formatters';
import { IS_BETA_MODE, BETA_CONFIG } from '../../config/beta';

interface HeaderProps {
  toggleSidebar: () => void;
}

export function Header({ toggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { subscription, loading: subscriptionLoading } = useStripeSubscription();
  const { unreadCount, announcements, markAsRead, markAllAsRead } = useAnnouncements();
  const [showAnnouncementsDropdown, setShowAnnouncementsDropdown] = useState(false);

  // Get current subscription plan name
  const currentProduct = React.useMemo(() => {
    if (subscriptionLoading || !subscription?.price_id) {
      return null;
    }
    return stripeProducts.find(p => p.priceId === subscription.price_id) || null;
  }, [subscription, subscriptionLoading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.announcements-dropdown')) {
        setShowAnnouncementsDropdown(false);
      }
    };

    if (showAnnouncementsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAnnouncementsDropdown]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPlanIcon = () => {
    if (subscriptionLoading || !currentProduct) return null;
    
    if (currentProduct.interval === 'year') {
      return <Crown className="h-4 w-4 text-yellow-500" />;
    } else {
      return <Star className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPlanName = () => {
    if (subscriptionLoading) return 'Loading...';
    if (!currentProduct) return 'Free Plan';
    return currentProduct.name;
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 ">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={toggleSidebar}
            className="sm:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 w-48 xl:w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Announcements Bell Icon */}
          <div className="relative announcements-dropdown">
            <button 
              onClick={() => setShowAnnouncementsDropdown(!showAnnouncementsDropdown)}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
            <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center min-w-0">
                  {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            </button>

            {/* Announcements Dropdown */}
            {showAnnouncementsDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Announcements</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {announcements.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm">No announcements</p>
                    </div>
                  ) : (
                    announcements.slice(0, 10).map((announcement) => (
                      <div
                        key={announcement.id}
                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
                          !announcement.is_read ? 'bg-blue-50 border-l-4 border-blue-400' : ''
                        }`}
                        onClick={() => {
                          if (!announcement.is_read) {
                            markAsRead(announcement.id);
                          }
                          navigate('/announcements');
                          setShowAnnouncementsDropdown(false);
                        }}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Bell className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${!announcement.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {announcement.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {announcement.content.substring(0, 100)}
                              {announcement.content.length > 100 ? '...' : ''}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatTimeAgo(announcement.created_at)} • {announcement.creator_name}
                            </div>
                          </div>
                          {!announcement.is_read && (
                            <div className="flex-shrink-0">
                              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {announcements.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-200">
                    <Link
                      to="/announcements"
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      onClick={() => setShowAnnouncementsDropdown(false)}
                    >
                      View all announcements →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-medium text-gray-900">{user?.name}</span>
              {IS_BETA_MODE && BETA_CONFIG.showBetaBadge && (
                <span className="text-xs text-blue-600 font-medium">Beta User</span>
              )}
              {!subscriptionLoading && (
                <div className="flex items-center space-x-1">
                  {getPlanIcon()}
                  <span className="text-xs text-gray-500 truncate max-w-24">{getPlanName()}</span>
                </div>
              )}
              {subscriptionLoading && (
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-gray-600"></div>
                  <span className="text-xs text-gray-500">Loading...</span>
                </div>
              )}
            </div>
            
            <div className="relative group">
              <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 cursor-pointer">
                <div className="h-8 w-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>
              
              <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center space-x-2 w-full px-3 sm:px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
                <hr className="my-2" />
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 w-full px-3 sm:px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}