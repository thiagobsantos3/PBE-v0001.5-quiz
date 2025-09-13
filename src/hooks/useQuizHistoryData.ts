import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Define QuizHistoryEntry interface locally since it's not in types
interface QuizHistoryEntry {
  id: string;
  title: string;
  type: 'quick-start' | 'custom' | 'study-assignment';
  completed_at: string;
  created_at: string;
  total_points: number;
  max_points: number;
  total_actual_time_spent_seconds: number;
  questions_count: number;
  approval_status?: 'approved' | 'pending' | 'rejected';
  suspicion_status?: 'green' | 'amber' | 'red';
  suspicion_score?: number;
  suspicious_summary?: any;
}

interface UseQuizHistoryDataProps {
  userId: string | undefined;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export function useQuizHistoryData({ userId, startDate, endDate, page = 1, pageSize = 10 }: UseQuizHistoryDataProps) {
  const [data, setData] = useState<QuizHistoryEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuizHistory = useCallback(async () => {
    if (!userId) {
      setData([]);
      setTotalCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 useQuizHistoryData: Fetching quiz history for user:', userId, 'with date range:', startDate, endDate, 'page:', page, 'pageSize:', pageSize);

      // First, get the total count
      let countQuery = supabase
        .from('quiz_sessions_view')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (startDate) {
        countQuery = countQuery.gte('completed_at', startDate.toISOString());
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        countQuery = countQuery.lt('completed_at', endDatePlusOne.toISOString());
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('❌ useQuizHistoryData: Error fetching count:', countError);
        throw countError;
      }

      setTotalCount(count || 0);

      // Then, get the paginated data
      let dataQuery = supabase
        .from('quiz_sessions_view')
        .select(`
          id,
          title,
          type,
          completed_at,
          created_at,
          total_points,
          max_points,
          total_actual_time_spent_seconds,
          questions_count,
          approval_status,
          suspicion_status,
          suspicion_score,
          suspicious_summary
        `)
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (startDate) {
        dataQuery = dataQuery.gte('completed_at', startDate.toISOString());
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        dataQuery = dataQuery.lt('completed_at', endDatePlusOne.toISOString());
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      dataQuery = dataQuery
        .order('completed_at', { ascending: false })
        .range(from, to);

      const { data: sessions, error: sessionsError } = await dataQuery;

      if (sessionsError) {
        console.error('❌ useQuizHistoryData: Error fetching quiz sessions:', sessionsError);
        throw sessionsError;
      }

      console.log('✅ useQuizHistoryData: Fetched', sessions?.length || 0, 'quiz history entries for page', page);

      // Data is already in the correct format from the view
      setData(sessions || []);

    } catch (err: any) {
      console.error('💥 useQuizHistoryData: Failed to fetch quiz history:', err);
      setError(err.message || 'Failed to load quiz history');
      setData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, page, pageSize]);

  useEffect(() => {
    fetchQuizHistory();
  }, [fetchQuizHistory]);

  return { data, totalCount, loading, error, refreshData: fetchQuizHistory };
}

// Export a function to update local quiz history entry
export function useQuizHistoryDataWithLocalUpdate({ userId, startDate, endDate, page, pageSize }: UseQuizHistoryDataProps) {
  const { data, totalCount, loading, error, refreshData } = useQuizHistoryData({ userId, startDate, endDate, page, pageSize });
  const [localData, setLocalData] = useState<QuizHistoryEntry[]>([]);

  // Sync local data with hook data
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const updateLocalQuizHistoryEntry = useCallback((sessionId: string, updates: Partial<QuizHistoryEntry>) => {
    setLocalData(prev => prev.map(entry => 
      entry.id === sessionId ? { ...entry, ...updates } : entry
    ));
  }, []);

  return { 
    data: localData, 
    totalCount,
    loading, 
    error, 
    refreshData,
    updateLocalQuizHistoryEntry 
  };
}