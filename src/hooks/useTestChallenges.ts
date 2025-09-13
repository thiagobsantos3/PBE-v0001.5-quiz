import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ChallengedQuizSession {
  id: string;
  title: string;
  type: string;
  user_id: string;
  user_name: string;
  completed_at: string;
  challenge_status: 'pending_review' | 'resolved_approved' | 'resolved_rejected';
  total_points: number;
  max_points: number;
  total_questions: number;
  challenged_questions_count: number;
  auto_graded_score: number;
  suspicion_status?: 'green' | 'amber' | 'red';
  suspicion_score?: number;
}

interface QuestionChallenge {
  question_id: string;
  question_text: string;
  answer_text: string;
  book_of_bible: string;
  chapter: number;
  user_typed_answer: string;
  auto_graded_points: number;
  max_points: number;
  time_spent: number;
  review_status: string;
}

export function useTestChallenges() {
  const { user, developerLog } = useAuth();
  const [challengedSessions, setChallengedSessions] = useState<ChallengedQuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallengedSessions = useCallback(async () => {
    if (!user?.teamId) {
      setLoading(false);
      setChallengedSessions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      developerLog('📥 Loading challenged quiz sessions for team:', user.teamId);

      // Fetch quiz sessions with pending challenges
      const { data: sessions, error: sessionsError } = await supabase
        .from('quiz_sessions')
        .select(`
          id,
          title,
          type,
          user_id,
          completed_at,
          challenge_status,
          total_points,
          max_points,
          questions,
          auto_graded_score,
          suspicion_status,
          suspicion_score
        `)
        .eq('team_id', user.teamId)
        .eq('status', 'completed')
        .in('challenge_status', ['pending_review', 'resolved_approved', 'resolved_rejected'])
        .order('completed_at', { ascending: false });

      if (sessionsError) {
        console.error('❌ Error loading challenged sessions:', sessionsError);
        throw sessionsError;
      }

      developerLog('✅ Challenged sessions loaded:', sessions?.length || 0);

      if (!sessions || sessions.length === 0) {
        setChallengedSessions([]);
        setLoading(false);
        return;
      }

      // Get user names for the sessions
      const userIds = [...new Set(sessions.map(s => s.user_id))];
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', userIds);

      if (profilesError) {
        console.error('❌ Error loading user profiles:', profilesError);
        // Continue without user names rather than failing
      }

      const userNamesMap = new Map(
        (userProfiles || []).map(profile => [profile.id, profile.name])
      );

      // Get challenged question counts for each session
      const sessionIds = sessions.map(s => s.id);
      const { data: questionLogs, error: logsError } = await supabase
        .from('quiz_question_logs')
        .select('quiz_session_id, review_status')
        .in('quiz_session_id', sessionIds)
        .eq('review_status', 'challenged');

      if (logsError) {
        console.error('❌ Error loading question logs:', logsError);
        // Continue without challenge counts
      }

      const challengeCountsMap = new Map<string, number>();
      (questionLogs || []).forEach(log => {
        const count = challengeCountsMap.get(log.quiz_session_id) || 0;
        challengeCountsMap.set(log.quiz_session_id, count + 1);
      });

      // Transform the data
      const transformedSessions: ChallengedQuizSession[] = sessions.map(session => ({
        id: session.id,
        title: session.title,
        type: session.type,
        user_id: session.user_id,
        user_name: userNamesMap.get(session.user_id) || 'Unknown User',
        completed_at: session.completed_at,
        challenge_status: session.challenge_status,
        total_points: session.total_points || 0,
        max_points: session.max_points || 0,
        total_questions: Array.isArray(session.questions) ? session.questions.length : 0,
        challenged_questions_count: challengeCountsMap.get(session.id) || 0,
        auto_graded_score: session.auto_graded_score || 0,
        suspicion_status: session.suspicion_status,
        suspicion_score: session.suspicion_score,
      }));

      setChallengedSessions(transformedSessions);

    } catch (err: any) {
      console.error('💥 Error loading challenged sessions:', err);
      setError(err.message || 'Failed to load challenged sessions');
      setChallengedSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.teamId, developerLog]);

  const getChallengedQuestions = useCallback(async (sessionId: string): Promise<QuestionChallenge[]> => {
    try {
      developerLog('📥 Loading challenged questions for session:', sessionId);

      // First, let's check what question logs exist for this session
      const { data: allLogs, error: allLogsError } = await supabase
        .from('quiz_question_logs')
        .select('question_id, review_status, typed_answer, points_earned, total_points_possible')
        .eq('quiz_session_id', sessionId);

      if (allLogsError) {
        console.error('❌ Error fetching all question logs for session:', sessionId, allLogsError);
      } else {
        console.log('🔍 All question logs for session:', sessionId, allLogs);
        console.log('🔍 Question logs with challenged status:', allLogs?.filter(log => log.review_status === 'challenged'));
      }
      // Get the quiz session to access the questions array
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('questions')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get question logs for challenged questions
      const { data: questionLogs, error: logsError } = await supabase
        .from('quiz_question_logs')
        .select(`
          question_id,
          typed_answer,
          points_earned,
          total_points_possible,
          time_spent,
          review_status
        `)
        .eq('quiz_session_id', sessionId)
        .eq('review_status', 'challenged');

      if (logsError) throw logsError;

      console.log('🔍 Challenged question logs found:', questionLogs?.length || 0);
      console.log('🔍 Challenged question logs data:', questionLogs);
      // Create a map of question details from the session
      const questionsMap = new Map();
      if (session?.questions && Array.isArray(session.questions)) {
        session.questions.forEach((q: any) => {
          questionsMap.set(q.id, q);
        });
      }

      console.log('🔍 Questions map from session:', questionsMap.size, 'questions');
      // Transform the data
      const challengedQuestions: QuestionChallenge[] = (questionLogs || []).map(log => {
        const questionData = questionsMap.get(log.question_id) || {};
        return {
          question_id: log.question_id,
          question_text: questionData.question || 'Question not found',
          answer_text: questionData.answer || 'Answer not found',
          book_of_bible: questionData.book_of_bible || 'Unknown',
          chapter: questionData.chapter || 0,
          user_typed_answer: log.typed_answer || '',
          auto_graded_points: log.points_earned || 0,
          max_points: log.total_points_possible || 0,
          time_spent: log.time_spent || 0,
          review_status: log.review_status || 'pending',
        };
      });

      developerLog('✅ Challenged questions loaded:', challengedQuestions.length);
      console.log('🔍 Final challenged questions data:', challengedQuestions);
      return challengedQuestions;

    } catch (err: any) {
      console.error('💥 Error loading challenged questions:', err);
      throw err;
    }
  }, [developerLog]);

  const resolveChallenge = useCallback(async (
    sessionId: string, 
    questionId: string, 
    finalPoints: number, 
    resolution: 'approved' | 'rejected'
  ): Promise<{ success: boolean; allChallengesResolved: boolean; newTotalPoints?: number }> => {
    try {

      developerLog('🔄 Resolving challenge:', { sessionId, questionId, finalPoints, resolution });

      // Update the question log with final points and resolution
      const { error: logError } = await supabase
        .from('quiz_question_logs')
        .update({
          points_earned: finalPoints,
          review_status: resolution === 'approved' ? 'reviewed_correct' : 'reviewed_incorrect',
          is_correct: finalPoints > 0
        })
        .eq('quiz_session_id', sessionId)
        .eq('question_id', questionId);

      if (logError) throw logError;

      // Check if all challenged questions for this session have been resolved
      const { data: remainingChallenges, error: remainingError } = await supabase
        .from('quiz_question_logs')
        .select('question_id')
        .eq('quiz_session_id', sessionId)
        .eq('review_status', 'challenged');

      if (remainingError) throw remainingError;

      const allChallengesResolved = !remainingChallenges || remainingChallenges.length === 0;
      let newTotalPoints: number | undefined;

      // If no more challenged questions, update the session status
      if (allChallengesResolved) {
        // Recalculate total points from all question logs
        const { data: allLogs, error: allLogsError } = await supabase
          .from('quiz_question_logs')
          .select('points_earned')
          .eq('quiz_session_id', sessionId);

        if (allLogsError) throw allLogsError;

        newTotalPoints = (allLogs || []).reduce((sum, log) => sum + (log.points_earned || 0), 0);

        // Update the quiz session
        const { error: sessionError } = await supabase
          .from('quiz_sessions')
          .update({
            challenge_status: 'resolved_approved',
            total_points: newTotalPoints,
            is_temporary_result: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        if (sessionError) throw sessionError;

        developerLog('✅ Challenge fully resolved, session updated');
      }

      developerLog('✅ Challenge resolved successfully:', { 
        sessionId, 
        questionId, 
        allChallengesResolved, 
        newTotalPoints 
      });

      return { 
        success: true, 
        allChallengesResolved, 
        newTotalPoints 
      };

    } catch (err: any) {
      console.error('💥 Error resolving challenge:', err);
      return { success: false, allChallengesResolved: false };
    }
  }, [fetchChallengedSessions, developerLog]);

  useEffect(() => {
    fetchChallengedSessions();
  }, [fetchChallengedSessions]);

  return {
    challengedSessions,
    setChallengedSessions,
    loading,
    error,
    fetchChallengedSessions,
    getChallengedQuestions,
    resolveChallenge,
  };
}