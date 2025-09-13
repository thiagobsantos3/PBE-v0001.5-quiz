import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Announcement, AnnouncementRead } from '../types';

export function useAnnouncements() {
  const { user, developerLog } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user?.teamId) {
      setAnnouncements([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      developerLog('📢 Loading announcements for user:', user.id, 'in team:', user.teamId);

      // Fetch announcements targeted to this user
      const { data: announcementsData, error: announcementsError } = await supabase
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
        .eq('status', 'active')
        .or(`start_date.is.null,start_date.lte.${new Date().toISOString()}`)
        .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      if (announcementsError) {
        console.error('❌ Error fetching announcements:', announcementsError);
        throw announcementsError;
      }

      // Filter announcements based on targeting
      const filteredAnnouncements = (announcementsData || []).filter(announcement => {
        if (announcement.target_type === 'entire_team') {
          return true;
        } else if (announcement.target_type === 'specific_members') {
          return announcement.target_members?.includes(user.id);
        }
        return false;
      });

      // Get creator names for announcements
      const creatorIds = [...new Set(filteredAnnouncements.map(a => a.created_by))];
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

      // Get read status for these announcements
      const announcementIds = filteredAnnouncements.map(a => a.id);
      const { data: readData, error: readError } = await supabase
        .from('announcement_reads')
        .select('announcement_id, read_at')
        .eq('user_id', user.id)
        .in('announcement_id', announcementIds);

      if (readError) {
        console.warn('⚠️ Could not load read status:', readError);
      }

      const readMap = new Map(
        (readData || []).map(read => [read.announcement_id, read.read_at])
      );

      // Transform announcements with creator names and read status
      const transformedAnnouncements: Announcement[] = filteredAnnouncements.map(announcement => ({
        ...announcement,
        creator_name: creatorsMap.get(announcement.created_by) || 'Unknown User',
        target_members: announcement.target_members || [],
        is_read: readMap.has(announcement.id),
        read_at: readMap.get(announcement.id)
      }));

      // Calculate unread count
      const unreadCount = transformedAnnouncements.filter(a => !a.is_read).length;

      developerLog('✅ Announcements loaded:', transformedAnnouncements.length, 'total,', unreadCount, 'unread');
      setAnnouncements(transformedAnnouncements);
      setUnreadCount(unreadCount);

    } catch (err: any) {
      console.error('💥 Error loading announcements:', err);
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [user?.teamId, user?.id, developerLog]);

  const markAsRead = useCallback(async (announcementId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('announcement_reads')
        .upsert({
          announcement_id: announcementId,
          user_id: user.id,
          read_at: new Date().toISOString()
        }, { onConflict: 'announcement_id,user_id' });

      if (error) {
        console.error('❌ Error marking announcement as read:', error);
        return;
      }

      // Update local state
      setAnnouncements(prev => prev.map(announcement => 
        announcement.id === announcementId 
          ? { ...announcement, is_read: true, read_at: new Date().toISOString() }
          : announcement
      ));

      setUnreadCount(prev => Math.max(0, prev - 1));
      developerLog('✅ Announcement marked as read:', announcementId);

    } catch (error) {
      console.error('💥 Error marking announcement as read:', error);
    }
  }, [user, developerLog]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const unreadAnnouncements = announcements.filter(a => !a.is_read);
    if (unreadAnnouncements.length === 0) return;

    try {
      const readEntries = unreadAnnouncements.map(announcement => ({
        announcement_id: announcement.id,
        user_id: user.id,
        read_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('announcement_reads')
        .upsert(readEntries, { onConflict: 'announcement_id,user_id' });

      if (error) {
        console.error('❌ Error marking all announcements as read:', error);
        return;
      }

      // Update local state
      setAnnouncements(prev => prev.map(announcement => ({
        ...announcement,
        is_read: true,
        read_at: new Date().toISOString()
      })));

      setUnreadCount(0);
      developerLog('✅ All announcements marked as read');

    } catch (error) {
      console.error('💥 Error marking all announcements as read:', error);
    }
  }, [user, announcements, developerLog]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return {
    announcements,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refreshAnnouncements: fetchAnnouncements
  };
}