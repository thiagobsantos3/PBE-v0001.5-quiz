import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { QuizSession, QuizSessionContextType } from '../types';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useQuizCompletionProcessor } from '../hooks/useQuizCompletionProcessor';

// Add missing type definition
interface QuizResult {
  questionId: string;
  pointsEarned: number;
  totalPoints: number;
  timeSpent: number;
}

// Assume these types exist based on the new tables the user needs to create
interface UserStats {
  user_id: string;
  total_xp: number;
  current_level: number;
  longest_streak: number;
  last_quiz_date?: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  criteria_type: string;
  criteria_value: number;
  badge_icon_url: string;
}

interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

const QuizSessionContext = createContext<QuizSessionContextType | undefined>(undefined);

export function QuizSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const { user, developerLog, refreshUser } = useAuth();
  const { showNotification } = useNotification();
  const { processQuizCompletion } = useQuizCompletionProcessor();

  // Load sessions from Supabase when user changes
  useEffect(() => {
    if (user) {
      loadUserSessions();
    } else {
      setSessions([]);
    }
  }, [user]);

  const loadUserSessions = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch recent session summaries (lightweight)
      const { data: summaries, error: summariesError } = await supabase
        .from('quiz_sessions')
        .select('id, title, type, status, total_points, max_points, total_actual_time_spent_seconds, completed_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (summariesError) throw summariesError;

      // Fetch full details for active sessions to power the Resume UI
      const { data: activeDetails, error: activeError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (activeError) throw activeError;

      // Merge: start with summaries, then overlay active session details
      setSessions(prev => {
        const previousById = new Map(prev.map(s => [s.id, s]));
        const mergedSummaries = (summaries || []).map(s => {
          const existing = previousById.get(s.id);
          return existing ? { ...existing, ...s } : (s as any);
        });
        const mergedById = new Map(mergedSummaries.map(s => [s.id, s]));
        (activeDetails || []).forEach(detailed => {
          const existing = mergedById.get(detailed.id) || previousById.get(detailed.id);
          mergedById.set(detailed.id, existing ? { ...existing, ...detailed } : detailed);
        });
        // Ensure any currently active sessions not in the fetched window are preserved
        const preservedActive = prev.filter(s => s.status === 'active' && !mergedById.has(s.id));
        return [...preservedActive, ...Array.from(mergedById.values())];
      });
    } catch (error) {
      console.error('Error loading quiz sessions:', error);
    }
  }, [user]);

  const createQuizSession = useCallback(async (sessionData: Omit<QuizSession, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    try {
      developerLog('🚀 Creating quiz session...', sessionData);
      
      const { data, error } = await supabase
        .from('quiz_sessions')
        .insert([sessionData])
        .select('id')
        .single();

      if (error) {
        developerLog('❌ Error creating quiz session:', error);
        throw error;
      }

      developerLog('✅ Quiz session created successfully:', data);

      // Add to local state with minimal data, will be loaded fully when needed
      const minimalSession = { ...sessionData, id: data.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setSessions(prev => [minimalSession as QuizSession, ...prev]);
      
      return data.id;
    } catch (error) {
      developerLog('💥 Error creating quiz session:', error);
      throw error;
    }
  }, [user]);

  const loadQuizSession = useCallback((sessionId: string): QuizSession | null => {
    return sessions.find(session => session.id === sessionId) || null;
  }, [sessions]);

  const loadQuizSessionAsync = useCallback(async (sessionId: string): Promise<QuizSession | null> => {
    // First try to find in local state
    const localSession = sessions.find(session => session.id === sessionId);
    if (localSession) {
      // Detect partial/local summary objects (e.g., after list refresh) and refetch full details
      const isPartial = !Array.isArray((localSession as any).questions) || (localSession as any).questions.length === 0;
      if (isPartial) {
        developerLog('ℹ️ Local session is partial, refetching full data from database:', sessionId);
      } else {
        developerLog('✅ Found full quiz session in local state:', sessionId);
        return localSession;
      }
    }

    // If not found locally or partial, fetch from database
    try {
      developerLog('🔄 Fetching quiz session from database:', sessionId);

      // Ensure user ID is available before querying
      if (!user?.id) {
        developerLog('⚠️ User ID not available, cannot fetch quiz session from database.');
        return null;
      }
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user?.id)
        .maybeSingle();

      developerLog('🔍 Supabase query result:', { 
        sessionId, 
        userId: user?.id, 
        hasData: !!data, 
        error: error?.message || null,
        dataId: data?.id || null,
        dataStatus: data?.status || null
      });

      if (error) {
        developerLog('❌ Error fetching quiz session from database:', error);
        return null;
      }

      if (!data) {
        developerLog('⚠️ Quiz session not found in database:', sessionId);
        return null;
      }

      developerLog('✅ Quiz session fetched from database:', data);

      // Merge into local state, preserving any existing fields if present
      setSessions(prev => {
        const exists = prev.find(s => s.id === sessionId);
        if (exists) {
          return prev.map(s => (s.id === sessionId ? { ...s, ...data } : s));
        }
        return [data, ...prev];
      });

      return data as any;
    } catch (error) {
      developerLog('💥 Exception caught in loadQuizSessionAsync:', error);
      return null;
    }
  }, [sessions, user?.id, developerLog]);


  const getActiveSessionsForUser = useCallback((userId: string): QuizSession[] => {
    return sessions.filter(session => 
      session.user_id === userId && session.status === 'active'
    );
  }, [sessions]);

  const getSessionForAssignment = useCallback((assignmentId: string, userId: string): QuizSession | null => {
    return sessions.find(session => 
      session.assignment_id === assignmentId && 
      session.user_id === userId
    ) || null;
  }, [sessions]);

  const deleteQuizSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    try {
      developerLog('🗑️ Deleting quiz session using RPC function:', sessionId);
      
      // Use the new RPC function to delete quiz and adjust gamification
      const { data, error } = await supabase.rpc('delete_quiz_and_adjust_gamification', {
        p_quiz_session_id: sessionId,
        p_user_id: user.id
      });

      if (error) {
        developerLog('❌ Error calling delete RPC function:', error);
        throw error;
      }

      if (!data?.success) {
        const errorMessage = data?.error || 'Failed to delete quiz session';
        developerLog('❌ RPC function returned error:', errorMessage);
        throw new Error(errorMessage);
      }

      developerLog('✅ Quiz session deleted successfully via RPC');

      // Remove from local state
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // Refresh user data to update gamification stats on frontend
      try {
        await refreshUser();
        developerLog('✅ User data refreshed after quiz deletion');
      } catch (refreshError) {
        developerLog('⚠️ Could not refresh user data after deletion:', refreshError);
        // Don't throw here as the deletion was successful
      }
      
    } catch (error) {
      developerLog('💥 Error deleting quiz session:', error);
      throw error;
    }
  }, [user, developerLog, refreshUser]);

  // Helper to calculate total points from results array
  const calculateTotalPointsFromResults = (results: QuizResult[]): number => {
    if (!results || !Array.isArray(results)) return 0;
    return results.reduce((sum, result) => sum + (Number(result.pointsEarned) || 0), 0);
  };

  // Helper to calculate total time spent from results array
  const calculateTotalTimeSpentFromResults = (results: QuizResult[]): number => {
    if (!results || !Array.isArray(results)) return 0;
    return results.reduce((sum, result) => sum + (Number(result.timeSpent) || 0), 0);
  };

  const updateQuizSession = useCallback(async (sessionId: string, updates: Partial<QuizSession>): Promise<void> => {
    // Input validation
    if (!sessionId) throw new Error('Session ID is required');
    if (!updates) throw new Error('Updates object is required');
    if (!user) throw new Error('User not authenticated');

    try {
      developerLog('🔄 Updating quiz session:', sessionId, 'with updates:', updates);
      
      // Get current session data
      const currentSession = sessions.find(s => s.id === sessionId);
      if (!currentSession) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // Prepare final updates object
      let finalUpdates = { ...updates };

      // If results are updated, recalculate derived values
      // Handle completion logic
      if (updates.status === 'completed') {
        developerLog('🎯 Quiz session being marked as completed');

        // Ensure total_points and total_actual_time_spent_seconds are updated for completion
        finalUpdates.total_points = calculateTotalPointsFromResults(updates.results || currentSession.results);
        finalUpdates.total_actual_time_spent_seconds = calculateTotalTimeSpentFromResults(updates.results || currentSession.results);


        // Update the quiz session in database first
        const { error: updateError } = await supabase
          .from('quiz_sessions')
          .update(finalUpdates)
          .eq('id', sessionId);

        if (updateError) {
          developerLog('❌ Error updating quiz session:', updateError);
          throw updateError;
        }

        developerLog('✅ Quiz session updated successfully');

        // Ensure actual time is recorded using authoritative logs as fallback
        try {
          const { data: timeLogs, error: timeErr } = await supabase
            .from('quiz_question_logs')
            .select('time_spent')
            .eq('quiz_session_id', sessionId);

          if (!timeErr && Array.isArray(timeLogs)) {
            const sumSeconds = timeLogs.reduce((sum: number, r: any) => sum + (Number(r?.time_spent) || 0), 0);
            const currentSeconds = Number(finalUpdates.total_actual_time_spent_seconds) || 0;
            if (sumSeconds > 0 && sumSeconds !== currentSeconds) {
              developerLog('⏱ Updating total_actual_time_spent_seconds from logs sum:', { sumSeconds, currentSeconds });
              const { error: setTimeErr } = await supabase
                .from('quiz_sessions')
                .update({ total_actual_time_spent_seconds: sumSeconds })
                .eq('id', sessionId);
              if (!setTimeErr) {
                // Also reflect in local state immediately
                finalUpdates.total_actual_time_spent_seconds = sumSeconds;
              }
            }
          }
        } catch (tErr) {
          developerLog('⚠️ Could not ensure actual time from logs (non-blocking):', tErr);
        }

        // Process quiz completion (gamification, achievements, suspicion, etc.)
        try {
          const completionResult = await processQuizCompletion({
            ...currentSession,
            ...finalUpdates,
            completed_at: finalUpdates.completed_at || new Date().toISOString()
          });

          if (completionResult.success) {
            developerLog('✅ Quiz completion processing successful');
            // Update local state with any additional fields from completion processing
            if (completionResult.bonusXp) {
              finalUpdates.bonus_xp = completionResult.bonusXp;
            }
            if (completionResult.suspicionStatus) {
              finalUpdates.suspicion_status = completionResult.suspicionStatus;
            }
            if (completionResult.suspicionScore !== undefined) {
              finalUpdates.suspicion_score = completionResult.suspicionScore;
            }
          } else {
            developerLog('❌ Quiz completion processing failed:', completionResult.error);
          }
        } catch (completionError) {
          developerLog('💥 Error in quiz completion processing:', completionError);
          // Don't throw here to avoid breaking the main quiz completion flow
        }

      } else {
        // For non-completion updates, just update the session
        // Normalize invalid approval status values to avoid enum errors

        const { error: updateError } = await supabase
          .from('quiz_sessions')
          .update(finalUpdates)
          .eq('id', sessionId);

        if (updateError) {
          developerLog('❌ Error updating quiz session:', updateError);
          throw updateError;
        }
      }

      // Update local state
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, ...finalUpdates } : session
      ));

      developerLog('✅ Quiz session update completed successfully');

    } catch (error) {
      developerLog('💥 Error in updateQuizSession:', error);
      throw error;
    }
  }, [user, sessions, developerLog, processQuizCompletion]);

  const updateQuizApprovalStatus = useCallback(async (sessionId: string, status: 'approved' | 'rejected'): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    if (!sessionId) throw new Error('Session ID is required');

    try {
      developerLog('🔄 Updating quiz approval status:', sessionId, 'to:', status);

      const { error } = await supabase
        .from('quiz_sessions')
        .update({ approval_status: status, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) {
        developerLog('❌ Error updating quiz approval status:', error);
        throw error;
      }

      setSessions(prev => prev.map(session =>
        session.id === sessionId ? { ...session, approval_status: status } : session
      ));

      developerLog('✅ Quiz approval status updated successfully');
    } catch (error) {
      developerLog('💥 Error in updateQuizApprovalStatus:', error);
      throw error;
    }
  }, [user, developerLog]);

  const value = {
    sessions,
    createQuizSession,
    updateQuizSession,
    loadQuizSession,
    loadQuizSessionAsync,
    loadUserSessions,
    getActiveSessionsForUser,
    getSessionForAssignment,
    deleteQuizSession,
    updateQuizApprovalStatus
  };

  return (
    <QuizSessionContext.Provider value={value}>
      {children}
    </QuizSessionContext.Provider>
  );
}

export function useQuizSession() {
  const context = useContext(QuizSessionContext);
  if (context === undefined) {
    throw new Error('useQuizSession must be used within a QuizSessionProvider');
  }
  return context;
}