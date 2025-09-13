import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuizSession } from '../contexts/QuizSessionContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertTriangle } from 'lucide-react';
import { QuizSession, QuizResult } from '../types';
import { gradeTypedAnswer } from '../utils/answerGrading';
import { useQuizTimer } from '../hooks/useQuizTimer';
import { useQuizTheme } from '../hooks/useQuizTheme';
import { QuizHeader } from '../components/quiz/QuizHeader';
import TestQuestion from '../components/quiz/TestQuestion';
import TestAnswer from '../components/quiz/TestAnswer';
import { TestControls } from '../components/quiz/TestControls';
import { TestCompletionSummary } from '../components/quiz/TestCompletionSummary';
import { PartialPointsModal } from '../components/quiz/PartialPointsModal';
import { ReportProblemModal } from '../components/quiz/ReportProblemModal';
import { AlertMessage } from '../components/common/AlertMessage';
import { Flag } from 'lucide-react';

export function TestRunner() {
  const navigate = useNavigate();
  const params = useParams<{ quizSessionId?: string; sessionId?: string }>();
  const { user, developerLog } = useAuth();
  const { 
    loadQuizSession,
    loadQuizSessionAsync,
    updateQuizSession, 
    deleteQuizSession 
  } = useQuizSession();

  // Track when each question starts for accurate time calculation
  const questionStartTimeRef = useRef<number | null>(null);
  // Track if we've already attempted to load the session to prevent duplicate calls
  const loadAttempted = useRef(false);

  // Use quizSessionId from URL params
  const quizSessionId = params.quizSessionId || params.sessionId;
  const backUrl = '/quiz/test-assignments';

  // Add early return if quizSessionId is not available yet
  useEffect(() => {
    developerLog('🔍 TestRunner: quizSessionId availability check:', {
      paramsQuizSessionId: params.quizSessionId,
      paramsSessionId: params.sessionId,
      derivedQuizSessionId: quizSessionId,
      hasUser: !!user,
      userId: user?.id
    });
  }, [params.quizSessionId, params.sessionId, quizSessionId, user]);

  // Debugging: Log params and derived quizSessionId on every render
  developerLog('🔍 TestRunner: Render - params.quizSessionId:', params.quizSessionId);
  developerLog('🔍 TestRunner: Render - derived quizSessionId:', quizSessionId);
  developerLog('🔍 TestRunner: Render - user:', user ? user.id : 'null');

  // Load session data
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isReviewPhase, setIsReviewPhase] = useState(false);
  const [partialPoints, setPartialPoints] = useState(0);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [completionStats, setCompletionStats] = useState<{
    totalPointsEarned: number;
    totalPossiblePoints: number;
    accuracy: number;
    correctAnswers: number;
    totalQuestions: number;
    averageTime: number;
  } | null>(null);
  
  // Report problem state
  const [showReportProblemModal, setShowReportProblemModal] = useState(false);
  const [isReportingProblem, setIsReportingProblem] = useState(false);
  const [reportProblemSuccess, setReportProblemSuccess] = useState<string | null>(null);
  const [reportProblemError, setReportProblemError] = useState<string | null>(null);

  // Custom hooks
  const { isDarkMode, themeClasses, toggleDarkMode } = useQuizTheme(isFullScreen);
  
  const {
    timeLeft,
    timerActive,
    timerStarted,
    hasTimeExpired,
    startTimer,
    resetTimer,
    stopTimer,
    setHasTimeExpired,
    setTimerActiveState,
    setTimerStartedState
  } = useQuizTimer({
    initialTime: 30,
    onTimeExpired: () => {
      saveSessionState({ 
        timer_active: false, 
        has_time_expired: true 
      });
    },
    onTimeUpdate: React.useCallback((newTimeLeft) => {
      // Only update the database, don't trigger component re-render
      if (quizSessionId) {
        updateQuizSession(quizSessionId, { time_left: newTimeLeft });
      }
    }, [quizSessionId, updateQuizSession])
  });

  // Load session on mount
  useEffect(() => {
    // Prevent duplicate loading attempts
    developerLog('🔍 TestRunner: Load session useEffect triggered:', {
      quizSessionId,
      hasUser: !!user,
      userId: user?.id,
      loadAttempted: loadAttempted.current,
      paramsQuizSessionId: params.quizSessionId,
      paramsSessionId: params.sessionId
    });

    if (!quizSessionId || !user) {
      developerLog('⚠️ TestRunner: Prerequisites not met:', {
        hasQuizSessionId: !!quizSessionId,
        hasUser: !!user,
        quizSessionId,
        userId: user?.id
      });
      return;
    }

    if (loadAttempted.current) {
      developerLog('🔍 TestRunner: Load already attempted for this ID, skipping duplicate call:', quizSessionId);
      return;
    }
    
    // Ensure user is available before attempting to load the quiz session
    if (!user) {
      developerLog('⚠️ TestRunner: User not available yet, waiting to load quiz session:', {
        hasUser: !!user,
        quizSessionId
      });
      return;
    }

    // Mark that we're attempting to load
    loadAttempted.current = true;

    const loadSession = async () => {
      try {
        developerLog('🔄 Loading test session:', quizSessionId);
        
        // Try async loading which checks both local state and database
        const loadedSession = await loadQuizSessionAsync(quizSessionId);
        
        if (!loadedSession) {
          developerLog('❌ Test session not found:', quizSessionId);
          setLoading(false);
          setTimeout(() => {
            navigate(backUrl);
          }, 2000);
          return;
        }

        developerLog('✅ Test session loaded successfully:', loadedSession);
        setSession(loadedSession);
        
        // Restore quiz state from session
        if (loadedSession.status === 'completed') {
          setQuizCompleted(true);
        } else {
          // Start or resume the test immediately
          setShowAnswer(loadedSession.show_answer);
          resetTimer(loadedSession.time_left);
          setHasTimeExpired(loadedSession.has_time_expired);
          setTimerActiveState(loadedSession.timer_active);
          setTimerStartedState(loadedSession.timer_started);
          if (!loadedSession.show_answer) {
            questionStartTimeRef.current = Date.now();
          }
        }
        developerLog('🏁 TestRunner: loadSession completed successfully');
      } catch (error) {
        developerLog('💥 Error loading test session:', error);
        setLoading(false);
        setTimeout(() => {
          navigate(backUrl);
        }, 2000);
      } finally {
        setLoading(false);
        developerLog('🏁 TestRunner: loadSession finally block reached, loading set to false');
      }
    };

    loadSession();

    // Cleanup function to reset load attempt flag when dependencies change
    return () => {
      developerLog('🧹 TestRunner: Cleanup - resetting loadAttempted flag for:', quizSessionId);
      loadAttempted.current = false;
    };
  }, [quizSessionId, user?.id, loadQuizSessionAsync, navigate, resetTimer, setHasTimeExpired, setTimerActiveState, setTimerStartedState, developerLog]);

  // Save session state whenever it changes
  const saveSessionState = (updates: Partial<QuizSession>) => {
    if (!session) return;
    
    const updatedSession = { ...session, ...updates };
    setSession(updatedSession);
    updateQuizSession(quizSessionId, updates);
  };

  // Log question result to database
  const logQuestionResult = async (
    questionId: string,
    pointsEarned: number,
    totalPoints: number,
    timeSpent: number,
    isCorrect: boolean
  ) => {
    if (!user || !session) return;

    try {
      developerLog('📝 Logging question result to database:', {
        quiz_session_id: session.id,
        user_id: user.id,
        question_id: questionId,
        points_earned: pointsEarned,
        total_points_possible: totalPoints,
        time_spent: timeSpent,
        is_correct: isCorrect
      });

      const { error } = await supabase
        .from('quiz_question_logs')
        .insert([{
          quiz_session_id: session.id,
          user_id: user.id,
          question_id: questionId,
          points_earned: pointsEarned,
          total_points_possible: totalPoints,
          time_spent: timeSpent,
          answered_at: new Date().toISOString(),
          is_correct: isCorrect
        }]);

      if (error) {
        developerLog('❌ Error logging question result:', error);
        // Don't throw error to avoid disrupting quiz flow
      } else {
        developerLog('✅ Question result logged successfully');
      }
    } catch (error) {
      developerLog('💥 Unexpected error logging question result:', error);
      // Don't throw error to avoid disrupting quiz flow
    }
  };

  const handleSubmitAnswer = async () => {
    if (!session || !typedAnswer.trim()) return;
    
    developerLog('📝 TestRunner: handleSubmitAnswer called with:', {
      sessionId: session.id,
      userId: user?.id,
      typedAnswer: typedAnswer.trim(),
      typedAnswerLength: typedAnswer.trim().length,
      currentQuestionIndex: session.current_question_index,
      currentQuestionId: session.questions[session.current_question_index]?.id
    });
    
    const rawTimeSpentSeconds = questionStartTimeRef.current ? (Date.now() - questionStartTimeRef.current) / 1000 : 0;
    const timeSpent = rawTimeSpentSeconds > 0 && rawTimeSpentSeconds < 1 ? 1 : Math.floor(rawTimeSpentSeconds);
    
    const currentQuestion = session.questions[session.current_question_index];
    const actualPoints = Number(currentQuestion.points) || 0;
    
    // For mock tests and test assignments, initially award 0 points (provisional)
    const result: QuizResult = {
      questionId: currentQuestion.id,
      pointsEarned: 0, // Provisional - will be graded later
      totalPoints: actualPoints,
      timeSpent,
      answeredAt: new Date().toISOString(),
      typedAnswer: typedAnswer.trim(),
    };
    
    developerLog('📝 TestRunner: Submitting typed answer - creating result:', {
      questionId: currentQuestion.id,
      typedAnswer: typedAnswer.trim(),
      timeSpent: result.timeSpent,
      provisionalPoints: result.pointsEarned
    });
    
    // Log to database with typed answer
    try {
      const insertData = {
        quiz_session_id: session.id,
        user_id: user?.id,
        question_id: currentQuestion.id,
        points_earned: 0, // Provisional
        total_points_possible: actualPoints,
        time_spent: timeSpent,
        answered_at: new Date().toISOString(),
        is_correct: false, // Provisional - will be determined during review
        typed_answer: typedAnswer.trim(),
        review_status: 'pending'
      };
      
      developerLog('📝 TestRunner: About to insert into quiz_question_logs:', insertData);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('quiz_question_logs')
        .insert([insertData])
        .select(); // Add select to get the inserted data back
      
      if (insertError) {
        developerLog('❌ TestRunner: Error inserting into quiz_question_logs:', insertError);
        console.error('Database insertion error:', insertError);
        throw insertError;
      }
      
      developerLog('✅ TestRunner: Successfully inserted into quiz_question_logs:', insertResult);
      
    } catch (dbError) {
      developerLog('💥 TestRunner: Database operation failed:', dbError);
      console.error('Failed to save typed answer to database:', dbError);
      // Don't throw here to avoid breaking the quiz flow, but log the error
    }
    
    const newResults = [...session.results, result];
    
    const isLastQuestion = session.current_question_index >= session.questions.length - 1;
    if (isLastQuestion) {
      await completeQuiz(newResults);
    } else {
      saveSessionState({ results: newResults });
      nextQuestion();
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    stopTimer();
    setHasTimeExpired(false);
    saveSessionState({ 
      show_answer: true, 
      timer_active: false, 
      has_time_expired: false 
    });
  };

  const handleShowQuestion = () => {
    if (!session) return;
    
    const currentQuestion = session.questions[session.current_question_index];
    setShowAnswer(false);
    const newTime = currentQuestion?.time_to_answer || 30;
    resetTimer(newTime);
    setHasTimeExpired(false);
    
    saveSessionState({
      show_answer: false,
      time_left: newTime,
      timer_active: false,
      timer_started: false,
      has_time_expired: false
    });
  };

  const handleCorrect = async () => {
    if (!session) return; 
    const rawTimeSpentSeconds = questionStartTimeRef.current ? (Date.now() - questionStartTimeRef.current) / 1000 : 0;
    const timeSpent = rawTimeSpentSeconds > 0 && rawTimeSpentSeconds < 1 ? 1 : Math.floor(rawTimeSpentSeconds);
    
    const currentQuestion = session.questions[session.current_question_index];
    
    // Ensure we use the actual question points, not just 1
    const actualPoints = Number(currentQuestion.points) || 0;
    
    const result: QuizResult = {
      questionId: currentQuestion.id,
      pointsEarned: actualPoints,
      totalPoints: actualPoints,
      timeSpent,
      answeredAt: new Date().toISOString(),
      typedAnswer: typedAnswer, // Save the typed answer
    };
    
    developerLog('✅ TestRunner: Correct answer - creating result:', {
      questionId: currentQuestion.id,
      questionPoints: currentQuestion.points,
      actualPoints: actualPoints,
      pointsEarned: result.pointsEarned,
      totalPoints: result.totalPoints,
      timeSpent: result.timeSpent
    });
    
    const newResults = [...session.results, result];
    
    // Log to database
    await logQuestionResult(
      currentQuestion.id,
      actualPoints,
      actualPoints,
      timeSpent,
      true // is_correct = true
    );
    
    developerLog('📊 TestRunner: Updated results array:', {
      previousResultsLength: session.results.length,
      newResultsLength: newResults.length,
      newResult: result,
      allResults: newResults
    });
    
    const isLastQuestion = session.current_question_index >= session.questions.length - 1;
    if (isLastQuestion) {
      await completeQuiz(newResults);
    } else {
      saveSessionState({ results: newResults });
      nextQuestion();
    }
  };

  const handleIncorrect = async () => {
    if (!session) return; 
    const rawTimeSpentSeconds = questionStartTimeRef.current ? (Date.now() - questionStartTimeRef.current) / 1000 : 0;
    const timeSpent = rawTimeSpentSeconds > 0 && rawTimeSpentSeconds < 1 ? 1 : Math.floor(rawTimeSpentSeconds);
    
    const currentQuestion = session.questions[session.current_question_index];
    const actualPoints = Number(currentQuestion.points) || 0;
    
    if (actualPoints > 1) {
      setShowPartialModal(true);
    } else {
      const result: QuizResult = {
        questionId: currentQuestion.id,
        pointsEarned: 0,
        totalPoints: actualPoints,
        timeSpent,
        answeredAt: new Date().toISOString(),
        typedAnswer: typedAnswer, // Save the typed answer
      };
      
      developerLog('❌ TestRunner: Incorrect answer - creating result:', {
        questionId: currentQuestion.id,
        questionPoints: currentQuestion.points,
        actualPoints: actualPoints,
        pointsEarned: result.pointsEarned,
        totalPoints: result.totalPoints,
        timeSpent: result.timeSpent
      });
      
      // Log to database
      await logQuestionResult(
        currentQuestion.id,
        0,
        actualPoints,
        timeSpent,
        false // is_correct = false
      );
      
      const newResults = [...session.results, result];
      
      developerLog('📊 TestRunner: Updated results array (incorrect):', {
        previousResultsLength: session.results.length,
        newResultsLength: newResults.length,
        newResult: result,
        allResults: newResults
      });
      
      const isLastQuestion = session.current_question_index >= session.questions.length - 1;
      if (isLastQuestion) {
        await completeQuiz(newResults);
      } else {
        saveSessionState({ results: newResults });
        nextQuestion();
      }
    }
  };

  const handlePartialPoints = async () => {
    if (!session) return;
    
    const currentQuestion = session.questions[session.current_question_index];
    const timeSpent = questionStartTimeRef.current ? Math.floor((Date.now() - questionStartTimeRef.current) / 1000) : 0;
    const actualPoints = Number(currentQuestion.points) || 0;
    const actualPartialPoints = Number(partialPoints) || 0;
    
    const result: QuizResult = {
      questionId: currentQuestion.id,
      pointsEarned: actualPartialPoints,
      totalPoints: actualPoints,
      timeSpent,
      answeredAt: new Date().toISOString(),
      typedAnswer: typedAnswer, // Save the typed answer
    };
    
    developerLog('🔄 TestRunner: Partial points - creating result:', {
      questionId: currentQuestion.id,
      questionPoints: currentQuestion.points,
      actualPoints: actualPoints,
      partialPoints: partialPoints,
      actualPartialPoints: actualPartialPoints,
      pointsEarned: result.pointsEarned,
      totalPoints: result.totalPoints,
      timeSpent: result.timeSpent
    });
    
    // Log to database
    await logQuestionResult(
      currentQuestion.id,
      actualPartialPoints,
      actualPoints,
      timeSpent,
      false // is_correct = false (since it's not fully correct)
    );
    
    const newResults = [...session.results, result];
    
    developerLog('📊 TestRunner: Updated results array (partial):', {
      previousResultsLength: session.results.length,
      newResultsLength: newResults.length,
      newResult: result,
      allResults: newResults
    });
    
    const isLastQuestion = session.current_question_index >= session.questions.length - 1;
    if (isLastQuestion) {
      await completeQuiz(newResults);
    } else {
      saveSessionState({ results: newResults });
      setShowPartialModal(false);
      setPartialPoints(0);
      setTypedAnswer(''); // Reset typed answer after submitting
      nextQuestion();
    }
  };

  const nextQuestion = () => {
    if (!session) return;
    
    if (session.current_question_index < session.questions.length - 1) {
      const nextIndex = session.current_question_index + 1;
      const nextQuestion = session.questions[nextIndex];
      const newTime = nextQuestion?.time_to_answer || 30;
      
      setShowAnswer(false);
      setHasTimeExpired(false);
      resetTimer(newTime);
      questionStartTimeRef.current = Date.now();
      setTypedAnswer(''); // Reset typed answer for new question
      
      saveSessionState({
        current_question_index: nextIndex,
        show_answer: false,
        has_time_expired: false,
        time_left: newTime,
        timer_active: false,
        timer_started: false
      });
    } else {
      // If we somehow reach here without passing results, fall back to session state
      completeQuiz(session.results);
    }
  };

  // Ensure completion uses the latest results and persists a single, accurate update
  const completeQuiz = async (finalResults: QuizResult[]) => {
    if (!session || !quizSessionId) return;
    
    // Auto-grade typed answers with normalization + token-set fuzzy + partial credit
    const autoGradedResults = finalResults.map(result => {
      const question = session.questions.find(q => q.id === result.questionId);
      if (!question || !result.typedAnswer) return result;
      const graded = gradeTypedAnswer(result.typedAnswer, question, {
        fullCreditThreshold: 85,
        itemMatchThreshold: 85,
      });
      return {
        ...result,
        pointsEarned: graded.pointsEarned,
        isCorrect: graded.isCorrect,
      };
    });
    
    const finalTotalPoints = autoGradedResults.reduce((sum, r) => sum + (Number(r.pointsEarned) || 0), 0);

    // Compute a stable snapshot of stats for the confirmation screen to avoid flicker
    const totalPossiblePoints = autoGradedResults.reduce((sum, r) => sum + (Number(r.totalPoints) || 0), 0);
    const correctAnswers = autoGradedResults.filter(r => (r.pointsEarned || 0) === (r.totalPoints || 0)).length;
    const accuracy = totalPossiblePoints > 0 ? Math.round((finalTotalPoints / totalPossiblePoints) * 100) : 0;
    const averageTime = autoGradedResults.length > 0 ? Math.round(autoGradedResults.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / autoGradedResults.length) : 0;
    setCompletionStats({
      totalPointsEarned: finalTotalPoints,
      totalPossiblePoints,
      accuracy,
      correctAnswers,
      totalQuestions: autoGradedResults.length,
      averageTime,
    });

    developerLog('🏁 TestRunner: Test completion - final calculations:', {
      finalResultsLength: autoGradedResults.length,
      autoGradedResults,
      finalTotalPoints,
      sessionTotalPoints: session.total_points,
      accuracy,
      correctAnswers,
      totalPossiblePoints
    });

    setQuizCompleted(true);
    stopTimer();
    
    // For mock tests and test assignments, mark as temporary result
    await updateQuizSession(quizSessionId, {
      results: autoGradedResults,
      status: 'completed',
      completed_at: new Date().toISOString(),
      timer_active: false,
      total_points: finalTotalPoints,
      is_temporary_result: true,
      challenge_status: 'none',
      auto_graded_score: finalTotalPoints,
    });
    
    // Update question logs with auto-graded results
    for (const result of autoGradedResults) {
      try {
        await supabase
          .from('quiz_question_logs')
          .update({
            points_earned: result.pointsEarned,
            is_correct: result.isCorrect || false,
            typed_answer: result.typedAnswer,
            review_status: 'pending'
          })
          .eq('quiz_session_id', session.id)
          .eq('question_id', result.questionId);
      } catch (error) {
        console.error('Error updating question log:', error);
      }
    }
  };

  const calculateStats = () => {
    if (!session) return {
      totalPointsEarned: 0,
      totalPossiblePoints: 0,
      accuracy: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      averageTime: 0,
    };

    const results = Array.isArray(session.results) ? session.results : [];

    const totalPointsEarned = results.reduce((sum, result) => sum + (result?.pointsEarned || 0), 0);
    const totalPossiblePoints = results.reduce((sum, result) => sum + (result?.totalPoints || 0), 0);
    const correctAnswers = results.filter(result => (result?.pointsEarned || 0) === (result?.totalPoints || 0)).length;
    const accuracy = totalPossiblePoints > 0 ? Math.round((totalPointsEarned / totalPossiblePoints) * 100) : 0;
    const averageTime = results.length > 0 ? Math.round(results.reduce((sum, result) => sum + (result?.timeSpent || 0), 0) / results.length) : 0;

    return {
      totalPointsEarned,
      totalPossiblePoints,
      accuracy,
      correctAnswers,
      totalQuestions: results.length,
      averageTime,
    };
  };

  const restartQuiz = () => {
    deleteQuizSession(quizSessionId);
    navigate(backUrl);
  };

  const toggleFullScreen = () => {
    // Disable full screen on mobile devices (screen width < 640px)
    if (window.innerWidth < 640) {
      return;
    }
    setIsFullScreen(!isFullScreen);
  };

  const handleReportProblem = () => {
    setShowReportProblemModal(true);
    setReportProblemSuccess(null);
    setReportProblemError(null);
  };

  const onSubmitReport = async (problemDescription: string) => {
    if (!session || !user) return;
    
    const currentQuestion = session.questions[session.current_question_index];
    if (!currentQuestion) return;

    try {
      setIsReportingProblem(true);
      setReportProblemError(null);

      const { error } = await supabase
        .from('quiz_problem_reports')
        .insert([{
          user_id: user.id,
          quiz_session_id: session.id,
          question_id: currentQuestion.id,
          problem_description: problemDescription,
          question_text_snapshot: currentQuestion.question,
          answer_text_snapshot: currentQuestion.answer,
        }]);

      if (error) {
        console.error('Error submitting problem report:', error);
        setReportProblemError('Failed to submit problem report. Please try again.');
        return;
      }

      setReportProblemSuccess('Problem reported successfully. Thank you for your feedback!');
      setShowReportProblemModal(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setReportProblemSuccess(null);
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting problem report:', error);
      setReportProblemError('An unexpected error occurred. Please try again.');
    } finally {
      setIsReportingProblem(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Layout hideHeaderAndSidebar={isFullScreen}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading test session...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout hideHeaderAndSidebar={isFullScreen}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Session Not Found</h2>
            <p className="text-gray-600 mb-4">The test session could not be loaded. You will be redirected shortly.</p>
            <button
              onClick={() => navigate(backUrl)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              Go Back Now
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const currentStats = calculateStats();

  // Defensive checks to prevent crashes when session data is invalid
  if (!session.questions || !Array.isArray(session.questions) || session.questions.length === 0) {
    return (
      <Layout hideHeaderAndSidebar={isFullScreen}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Data Error</h2>
            <p className="text-gray-600 mb-4">
              The test session data appears to be corrupted or incomplete. This can happen after switching browser tabs during a test.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(backUrl)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                Return to Quiz Center
              </button>
              <div>
                <button
                  onClick={() => window.location.reload()}
                  className="text-gray-600 hover:text-gray-900 transition-colors duration-200 text-sm"
                >
                  Or try refreshing the page
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if current question index is valid
  if (session.current_question_index < 0 || session.current_question_index >= session.questions.length) {
    return (
      <Layout hideHeaderAndSidebar={isFullScreen}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Navigation Error</h2>
            <p className="text-gray-600 mb-4">
              The test session has an invalid question index. This can happen if the session data becomes corrupted.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(backUrl)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                Return to Quiz Center
              </button>
              <div>
                <button
                  onClick={() => window.location.reload()}
                  className="text-gray-600 hover:text-gray-900 transition-colors duration-200 text-sm"
                >
                  Or try refreshing the page
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Completion screen first to avoid computing currentQuestion when not needed
  if (quizCompleted) {
    return (
      <Layout hideHeaderAndSidebar={isFullScreen}>
        <TestCompletionSummary
          quizSessionId={quizSessionId}
          title={session.title}
          stats={completionStats || currentStats}
          isTemporary={session.is_temporary_result || false}
          challengeStatus={session.challenge_status || 'none'}
          onBack={() => navigate(backUrl)}
        />
      </Layout>
    );
  }

  const currentQuestion = session.questions?.[session.current_question_index];
  const progressPercentage = session.results.length > 0 ? Math.round((currentStats.correctAnswers / session.results.length) * 100) : 0;

  // Get user's typed answer for current question from results (for showing in TestAnswer)
  const currentQuestionResult = session.results.find(result => 
    result.questionId === currentQuestion?.id
  );
  const userTypedAnswer = currentQuestionResult?.typedAnswer || '';

  // Test in progress
  return (
    <Layout hideHeaderAndSidebar={isFullScreen}>
      <div className={`min-h-screen ${themeClasses.background} relative overflow-x-hidden`}>
        <QuizHeader
          isFullScreen={isFullScreen}
          isDarkMode={isDarkMode}
          currentQuestionIndex={session.current_question_index}
          totalQuestions={session.questions.length}
          progressPercentage={progressPercentage}
          timeLeft={timeLeft}
          timerStarted={timerStarted}
          showAnswer={showAnswer}
          themeClasses={themeClasses}
          onBack={() => navigate(backUrl)}
          onToggleFullScreen={toggleFullScreen}
          onToggleDarkMode={toggleDarkMode}
          onStartTimer={startTimer}
          formatTime={formatTime}
        />

        <div className={`${isFullScreen ? 'pt-28 sm:pt-40 px-4 sm:px-6 pb-32 sm:pb-32' : 'p-4 sm:p-6'}`}>
          <div className={`${isFullScreen ? 'w-full max-w-none' : 'max-w-4xl mx-auto'}`}>
            {/* Success/Error Messages */}
            {reportProblemSuccess && (
              <div className="mb-4">
                <AlertMessage
                  type="success"
                  message={reportProblemSuccess}
                  dismissible
                  onDismiss={() => setReportProblemSuccess(null)}
                />
              </div>
            )}
            
            {reportProblemError && (
              <div className="mb-4">
                <AlertMessage
                  type="error"
                  message={reportProblemError}
                  dismissible
                  onDismiss={() => setReportProblemError(null)}
                />
              </div>
            )}

            {/* Question content */}
            <div className={`${themeClasses.card} rounded-xl shadow-sm p-4 sm:p-8 ${isFullScreen ? 'w-full' : 'mx-auto max-w-3xl'} ${isFullScreen ? '' : 'border ' + themeClasses.border}`}>
              {!showAnswer ? (
                <TestQuestion
                  question={currentQuestion}
                  hasTimeExpired={hasTimeExpired}
                  isFullScreen={isFullScreen}
                  isDarkMode={isDarkMode}
                  themeClasses={themeClasses}
                  typedAnswer={typedAnswer}
                  onTypedAnswerChange={setTypedAnswer}
                />
              ) : (
                <TestAnswer
                  question={currentQuestion}
                  isFullScreen={isFullScreen}
                  isDarkMode={isDarkMode}
                  themeClasses={themeClasses}
                  userTypedAnswer={userTypedAnswer}
                />
              )}
            </div>
            
            {/* Report Problem Button */}
            <div className="flex justify-center mt-4">
              <button
                onClick={handleReportProblem}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                  isFullScreen 
                    ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Report a problem with this question"
              >
                <Flag className="h-4 w-4" />
                <span className="text-sm">Report Problem</span>
              </button>
            </div>
          </div>
        </div>

        <TestControls
          isFullScreen={isFullScreen}
          showAnswer={showAnswer}
          hasTimeExpired={hasTimeExpired}
          themeClasses={themeClasses}
          typedAnswer={typedAnswer}
          onSubmitAnswer={handleSubmitAnswer}
          onShowAnswer={handleShowAnswer}
          onShowQuestion={handleShowQuestion}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
          isReviewPhase={isReviewPhase}
        />

        <PartialPointsModal
          isOpen={showPartialModal}
          questionPoints={currentQuestion?.points || 0}
          selectedPoints={partialPoints}
          onPointsChange={setPartialPoints}
          onConfirm={handlePartialPoints}
          onCancel={() => setShowPartialModal(false)}
          themeClasses={themeClasses}
          isFullScreen={isFullScreen}
        />
        
        <ReportProblemModal
          isOpen={showReportProblemModal}
          onClose={() => setShowReportProblemModal(false)}
          onSubmit={onSubmitReport}
          questionText={currentQuestion?.question || ''}
          answerText={currentQuestion?.answer || ''}
          isSubmitting={isReportingProblem}
        />
      </div>
    </Layout>
  );
}