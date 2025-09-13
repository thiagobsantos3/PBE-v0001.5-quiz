import React, { useState } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AlertMessage } from '../components/common/AlertMessage';
import { formatTimeAgo } from '../utils/formatters';
import { 
  Bell, 
  Users, 
  User, 
  Calendar, 
  ExternalLink,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';

export function AnnouncementsView() {
  const { 
    announcements, 
    unreadCount, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead 
  } = useAnnouncements();
  
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredAnnouncements = announcements.filter(announcement => {
    if (filter === 'unread') {
      return !announcement.is_read;
    }
    return true;
  });

  const handleAnnouncementClick = (announcement: any) => {
    if (!announcement.is_read) {
      markAsRead(announcement.id);
    }
  };

  const getTargetDisplay = (announcement: any) => {
    if (announcement.target_type === 'entire_team') {
      return (
        <div className="flex items-center space-x-1 text-blue-600">
          <Users className="h-3 w-3" />
          <span>Entire Team</span>
        </div>
      );
    } else {
      const memberCount = announcement.target_members?.length || 0;
      return (
        <div className="flex items-center space-x-1 text-green-600">
          <User className="h-3 w-3" />
          <span>{memberCount} Member{memberCount !== 1 ? 's' : ''}</span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <LoadingSpinner fullScreen text="Loading announcements..." />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bell className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
              <p className="text-gray-600">
                Stay updated with important team communications and updates.
              </p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <AlertMessage
          type="error"
          message={error}
          className="mb-6"
        />
      )}
      
      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
            </div>
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  filter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({announcements.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  filter === 'unread'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            {filteredAnnouncements.length} announcement{filteredAnnouncements.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      
      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'unread' ? 'No Unread Announcements' : 'No Announcements'}
            </h3>
            <p className="text-gray-600">
              {filter === 'unread' 
                ? 'All announcements have been read.'
                : 'No announcements have been posted to your team yet.'
              }
            </p>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md cursor-pointer ${
                !announcement.is_read 
                  ? 'border-blue-200 bg-blue-50' 
                  : 'border-gray-200'
              }`}
              onClick={() => handleAnnouncementClick(announcement)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                        !announcement.is_read ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Bell className={`h-6 w-6 ${
                          !announcement.is_read ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className={`text-lg font-semibold ${
                          !announcement.is_read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {announcement.title}
                        </h3>
                        {!announcement.is_read && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>From: {announcement.creator_name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatTimeAgo(announcement.created_at)}</span>
                        </div>
                        {getTargetDisplay(announcement)}
                      </div>
                    </div>
                  </div>
                  
                  {announcement.is_read && (
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="mb-4">
                  <div className={`text-gray-900 whitespace-pre-wrap ${
                    !announcement.is_read ? 'font-medium' : ''
                  }`}>
                    {announcement.content}
                  </div>
                </div>
                
                {/* Attachment */}
                {announcement.attachment_url && (
                  <div className="mb-4">
                    <a
                      href={announcement.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>View Attachment</span>
                    </a>
                  </div>
                )}
                
                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    {announcement.start_date && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Started: {new Date(announcement.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {announcement.end_date && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Expires: {new Date(announcement.end_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  {announcement.is_read && announcement.read_at && (
                    <div className="text-green-600">
                      Read {formatTimeAgo(announcement.read_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Summary Stats */}
      {announcements.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-900">{announcements.length}</div>
              <div className="text-sm text-blue-700">Total Announcements</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-900">{unreadCount}</div>
              <div className="text-sm text-red-700">Unread</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-900">{announcements.length - unreadCount}</div>
              <div className="text-sm text-green-700">Read</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}