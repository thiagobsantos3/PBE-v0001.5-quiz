import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertMessage } from '../../components/common/AlertMessage';
import { Table, TableColumn } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { AnnouncementFormModal } from '../../components/admin/AnnouncementFormModal';
import { formatTimeAgo } from '../../utils/formatters';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Users,
  User,
  Calendar,
  Eye,
  Archive,
  Search,
  Filter
} from 'lucide-react';
import { Announcement } from '../../types';

export function AnnouncementManagement() {
  const { user, developerLog } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user?.teamId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      developerLog('📢 Loading announcements for team:', user.teamId);

      const { data, error: fetchError } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          created_by,
          team_id,
          target_type,
          target_members,
          status,
          start_date,
          end_date,
          attachment_url,
          created_at,
          updated_at
        `)
        .eq('team_id', user.teamId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('❌ Error fetching announcements:', fetchError);
        throw fetchError;
      }

      // Get creator names for announcements
      const creatorIds = [...new Set((data || []).map(a => a.created_by))];
      const { data: creators, error: creatorsError } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', creatorIds);

      if (creatorsError) {
        console.warn('⚠️ Could not load creator names:', creatorsError);
      }

      const creatorsMap = new Map(
        (creators || []).map(creator => [creator.id, creator.name])
      );

      // Transform announcements with creator names
      const transformedAnnouncements: Announcement[] = (data || []).map(announcement => ({
        ...announcement,
        creator_name: creatorsMap.get(announcement.created_by) || 'Unknown User',
        target_members: announcement.target_members || []
      }));

      developerLog('✅ Announcements loaded:', transformedAnnouncements.length);
      setAnnouncements(transformedAnnouncements);

    } catch (err: any) {
      console.error('💥 Error loading announcements:', err);
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [user?.teamId, developerLog]);

  const handleCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setShowAnnouncementModal(true);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setShowAnnouncementModal(true);
  };

  const handleDeleteAnnouncement = async (announcementId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete the announcement "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(announcementId);
      
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) {
        console.error('❌ Error deleting announcement:', error);
        throw error;
      }

      developerLog('✅ Announcement deleted successfully');
      await fetchAnnouncements(); // Refresh the list

    } catch (err: any) {
      console.error('💥 Error deleting announcement:', err);
      setError(err.message || 'Failed to delete announcement');
    } finally {
      setDeleting(null);
    }
  };

  const handleArchiveAnnouncement = async (announcementId: string) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', announcementId);

      if (error) {
        console.error('❌ Error archiving announcement:', error);
        throw error;
      }

      developerLog('✅ Announcement archived successfully');
      await fetchAnnouncements(); // Refresh the list

    } catch (err: any) {
      console.error('💥 Error archiving announcement:', err);
      setError(err.message || 'Failed to archive announcement');
    }
  };

  // Filter announcements based on search and filters
  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch = announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || announcement.status === statusFilter;
    const matchesTarget = targetFilter === 'all' || announcement.target_type === targetFilter;
    
    return matchesSearch && matchesStatus && matchesTarget;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'scheduled': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'archived': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'draft': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTargetDisplay = (announcement: Announcement) => {
    if (announcement.target_type === 'entire_team') {
      return 'Entire Team';
    } else {
      const memberCount = announcement.target_members?.length || 0;
      return `${memberCount} Member${memberCount !== 1 ? 's' : ''}`;
    }
  };

  const columns: TableColumn<Announcement>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (announcement) => (
        <div>
          <div className="font-medium text-gray-900">{announcement.title}</div>
          <div className="text-sm text-gray-600 line-clamp-2 mt-1">
            {announcement.content.substring(0, 100)}
            {announcement.content.length > 100 ? '...' : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'creator',
      header: 'Created By',
      render: (announcement) => (
        <div className="text-sm text-gray-900">
          {announcement.creator_name || 'Unknown'}
        </div>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'target',
      header: 'Target',
      render: (announcement) => (
        <div className="flex items-center space-x-2">
          {announcement.target_type === 'entire_team' ? (
            <Users className="h-4 w-4 text-blue-600" />
          ) : (
            <User className="h-4 w-4 text-green-600" />
          )}
          <span className="text-sm text-gray-900">
            {getTargetDisplay(announcement)}
          </span>
        </div>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'status',
      header: 'Status',
      render: (announcement) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(announcement.status)}`}>
          <span className="capitalize">{announcement.status}</span>
        </span>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (announcement) => (
        <div className="text-sm text-gray-600">
          {announcement.start_date && (
            <div>Start: {new Date(announcement.start_date).toLocaleDateString()}</div>
          )}
          {announcement.end_date && (
            <div>End: {new Date(announcement.end_date).toLocaleDateString()}</div>
          )}
          {!announcement.start_date && !announcement.end_date && (
            <span className="text-gray-400">No schedule</span>
          )}
        </div>
      ),
      className: 'whitespace-nowrap text-sm',
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (announcement) => (
        <div className="text-sm text-gray-600">
          {formatTimeAgo(announcement.created_at)}
        </div>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'actions',
      header: '',
      render: (announcement) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEditAnnouncement(announcement)}
            className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200"
            title="Edit announcement"
          >
            <Edit className="h-4 w-4" />
          </button>
          {announcement.status === 'active' && (
            <button
              onClick={() => handleArchiveAnnouncement(announcement.id)}
              className="text-yellow-600 hover:text-yellow-700 transition-colors duration-200"
              title="Archive announcement"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => handleDeleteAnnouncement(announcement.id, announcement.title)}
            disabled={deleting === announcement.id}
            className="text-red-600 hover:text-red-700 transition-colors duration-200 disabled:opacity-50"
            title="Delete announcement"
          >
            {deleting === announcement.id ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Check if user has permission to manage announcements
  const canManageAnnouncements = user?.teamRole === 'owner' || user?.teamRole === 'admin';

  if (!canManageAnnouncements) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bell className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You need to be a team owner or admin to manage announcements.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!user?.teamId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bell className="h-8 w-8 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Team Found</h1>
          <p className="text-gray-600 mb-6">
            You need to be part of a team to manage announcements.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <Bell className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Announcements</h1>
              <p className="text-sm sm:text-base text-gray-600">
                Create and manage team announcements and notifications.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleCreateAnnouncement}
          >
            Create Announcement
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <AlertMessage
            type="error"
            message={error}
            className="mb-6"
            dismissible
            onDismiss={() => setError(null)}
          />
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col space-y-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search announcements by title or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              
              <select
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="all">All Targets</option>
                <option value="entire_team">Entire Team</option>
                <option value="specific_members">Specific Members</option>
              </select>
              
              <div className="flex items-center text-sm text-gray-600">
                <Filter className="h-4 w-4 mr-2" />
                <span>{filteredAnnouncements.length} of {announcements.length} announcements</span>
              </div>
            </div>
          </div>
        </div>

        {/* Announcements Table */}
        <Table
          columns={columns}
          data={filteredAnnouncements}
          loading={loading}
          emptyState={{
            icon: Bell,
            title: "No Announcements Found",
            description: announcements.length === 0 
              ? "No announcements have been created yet. Create your first announcement to get started."
              : "No announcements match your search criteria.",
            action: announcements.length === 0 ? (
              <Button
                variant="primary"
                icon={Plus}
                onClick={handleCreateAnnouncement}
              >
                Create First Announcement
              </Button>
            ) : undefined
          }}
        />

        {/* Announcement Form Modal */}
        <AnnouncementFormModal
          isOpen={showAnnouncementModal}
          onClose={() => {
            setShowAnnouncementModal(false);
            setEditingAnnouncement(null);
          }}
          onSave={fetchAnnouncements}
          editingAnnouncement={editingAnnouncement}
        />
      </div>
  );
}