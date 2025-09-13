import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuizSession } from '../contexts/QuizSessionContext';
import { supabase } from '../lib/supabase'; // Keep this import
import {
  Zap,
  Edit,
  Calendar,
  ClipboardCheck,
  Clock,
  Target,
  TrendingUp,
  Trash2,
  Play,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { formatStudyItemsForAssignment } from '../utils/quizHelpers'; // Keep this import

interface RecentActivity {
  id: string;
  title: string;
  score: number;
  maxScore: number;
  completedAt: string;
  duration: number;
  type: string;
  approvalStatus?: string;
}

export function QuizCenter() {
  const { developerLog } = useAuth();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getActiveSessionsForUser, deleteQuizSession } = useQuizSession();
  
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]); // This is for completed quizzes
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(0);
  const itemsPerPage = 5;
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  
  // Get active quiz sessions for the current user
  const activeSessions = useMemo(() => {
    if (!user) return [];
    
    const sessions = getActiveSessionsForUser(user.id);
    developerLog('🔍 QuizCenter: Raw active sessions:', sessions);
    
    // Return all active sessions without filtering
    developerLog('🔍 QuizCenter: Showing all active sessions:', sessions.length);
    
    return sessions;
  }, [user, getActiveSessionsForUser]);

  // Memoized helper functions
  const calculateAccuracy = useCallback((totalPoints: number, maxPoints: number): number => {
    if (maxPoints === 0) return 0; // Defensive check for division by zero
    return Math.round((totalPoints / maxPoints) * 100);
  }, []);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessionToDeleteId(sessionId);
    setShowDeleteConfirmModal(true);
  }, []);
  
  const loadRecentActivities = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingActivities(true);
      
      const offset = (currentPage - 1) * itemsPerPage;
      
      // Get total count
      const { count } = await supabase
        .from('quiz_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed');

      setTotalActivitiesCount(count || 0);

      // Get paginated results
      const { data: sessions, error } = await supabase
        .from('quiz_sessions')
        .select('id, title, total_points, max_points, completed_at, total_actual_time_spent_seconds, type, approval_status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .range(offset, offset + itemsPerPage - 1);

      if (error) throw error;

      const activities: RecentActivity[] = sessions?.map(session => ({
        id: session.id,
        title: session.title || 'Quiz Session',
        score: session.total_points || 0,
        maxScore: session.max_points || 0,
        completedAt: session.completed_at,
        duration: Math.round((session.total_actual_time_spent_seconds || 0) / 60), // Convert to minutes
        type: session.type || 'quiz',
        approvalStatus: session.approval_status
      })) || [];

      setRecentActivities(activities);
      developerLog('Loaded recent activities:', activities);
    } catch (error) {
      console.error('Error loading recent activities:', error);
      developerLog('Error loading recent activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  }, [user, currentPage, itemsPerPage, developerLog, supabase]); // Added supabase to dependencies

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(totalActivitiesCount / itemsPerPage);

  const handleDeleteConfirm = useCallback(async () => {
    if (!sessionToDeleteId) return;

    try {
      await deleteQuizSession(sessionToDeleteId);
      setShowDeleteConfirmModal(false);
      setSessionToDeleteId(null);
      
      // Reload activities to reflect the deletion
      await loadRecentActivities();
    } catch (error) {
      console.error('Error deleting quiz session:', error);
      // You could add error handling UI here
    }
  }, [sessionToDeleteId, deleteQuizSession, loadRecentActivities]); // Added loadRecentActivities to dependencies

  const handleResumeQuiz = useCallback((sessionId: string) => {
    const session = activeSessions.find(s => s.id === sessionId);
    if (session) {
      // Check if this is a mock test
      const isTypedAnswerQuiz = session.type === 'mock-test' || session.type === 'assessment';
      const path = isTypedAnswerQuiz ? `/quiz/test-runner/${sessionId}` : `/quiz/runner/${sessionId}`;
      navigate(path);
    } else {
      // Fallback to regular quiz runner
      navigate(`/quiz/runner/${sessionId}`);
    }
  }, [navigate]); // Added navigate to dependencies

  // Load recent quiz activities
  useEffect(() => {
    loadRecentActivities();
  }, [loadRecentActivities]);

  const quizOptions = [
    {
      id: 'quick-start',
      title: 'Quick Start Quiz',
      description: 'Jump into a random quiz with questions from your subscription tier. Perfect for quick practice sessions.',
      icon: Zap,
      color: 'bg-green-500',
      bgColor: 'bg-green-50', // This is a Tailwind CSS class, not a variable
      borderColor: 'border-green-200',
      hoverColor: 'hover:bg-green-100',
      features: [
        'Random question selection',
        'Adaptive difficulty',
        'Instant feedback',
        'Mock PBE test experience'
      ],
      action: 'Start Quiz', // This is a string, not a function
      onClick: () => navigate('/quiz/quick-start'),
      disabled: !user?.planSettings?.allow_quick_start_quiz,
      tooltip: user?.planSettings?.allow_quick_start_quiz ? '' : 'Not available on your current plan',
    },
    {
      id: 'create-own',
      title: 'Create Your Own Quiz',
      description: 'Build custom quizzes by selecting specific books, chapters, and difficulty levels. Tailor your study experience.',
      icon: Edit,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50', // This is a Tailwind CSS class, not a variable
      borderColor: 'border-blue-200',
      hoverColor: 'hover:bg-blue-100',
      features: [
        'Choose specific topics',
        'Select question count',
        'Set difficulty level',
        'Customize question count'
      ],
      action: 'Create Quiz', // This is a string, not a function
      onClick: () => navigate('/quiz/create-own'),
      disabled: !user?.planSettings?.allow_create_own_quiz,
      tooltip: user?.planSettings?.allow_create_own_quiz ? '' : 'Not available on your current plan',
    },
    {
      id: 'study-schedule',
      title: 'Study Schedule Quiz',
      description: 'Follow a structured study plan with progressive difficulty and comprehensive coverage of the material.',
      icon: Calendar,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50', // This is a Tailwind CSS class, not a variable
      borderColor: 'border-purple-200',
      hoverColor: 'hover:bg-purple-100',
      features: [
        'Structured learning path',
        'Progressive difficulty',
        'Track your progress',
        'Daily study goals'
      ],
      action: 'View Schedule', // This is a string, not a function
      onClick: () => navigate('/schedule'),
      disabled: !user?.planSettings?.allow_study_schedule_quiz,
      tooltip: user?.planSettings?.allow_study_schedule_quiz ? '' : 'Upgrade to Pro plan to access Study Schedule',
    },
    {
      id: 'test-assignments',
      title: 'Assessments',
      description: 'Take formal assessments and mock tests assigned by your team administrators. Track your performance on standardized evaluations.',
      icon: ClipboardCheck,
      color: 'bg-red-500',
      bgColor: 'bg-red-50', // This is a Tailwind CSS class, not a variable
      borderColor: 'border-red-200',
      hoverColor: 'hover:bg-red-100',
      features: [
        'Formal assessments',
        'Mock PBE tests',
        'Performance tracking',
        'Admin-assigned tests',
        'Detailed result analysis'
      ],
      action: 'View Assessments',
      onClick: () => navigate('/quiz/test-assignments'),
      disabled: !user?.planSettings?.allow_test_assignments,
      tooltip: user?.planSettings?.allow_test_assignments ? '' : 'Upgrade to Pro plan to access Assessments',
    },
    {
      id: 'mock-test',
      title: 'Mock Test',
      description: 'Create your own practice test with typed answers. Review your responses and challenge any marking before final results.',
      icon: Edit,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      hoverColor: 'hover:bg-orange-100',
      features: [
        'Type your own answers',
        'Select specific content',
        'Review before final grading',
        'Challenge marking system',
        'Realistic test experience'
      ],
      action: 'Create Mock Test',
      onClick: () => navigate('/quiz/mock-test-creation'),
      disabled: !user?.planSettings?.allow_mock_test_creation,
      tooltip: user?.planSettings?.allow_mock_test_creation ? '' : 'Upgrade to Pro plan to access Mock Tests',
    },
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Center</h1>
          <p className="text-gray-600">
            Choose your study method and start practicing. Track your progress and improve your skills.
          </p>
        </div>

        {/* Active Sessions Alert */}
        {activeSessions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <RotateCcw className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Resume Quiz Sessions</h2>
            </div>
            <div className="space-y-3">
              {activeSessions.map((session) => {
                const totalQuestions = Array.isArray(session.questions) ? session.questions.length : 0;
                const currentQuestion = session.current_question_index + 1;
                const progressPercentage = totalQuestions > 0 ? Math.round((session.current_question_index / totalQuestions) * 100) : 0;
                const questionsAnswered = session.results ? session.results.length : session.current_question_index;
                const pointsEarned = session.total_points || 0;
                
                // Calculate time since session was created
                const createdAt = new Date(session.created_at);
                const now = new Date();
                const timeDiff = now.getTime() - createdAt.getTime();
                const minutesAgo = Math.floor(timeDiff / (1000 * 60));
                const hoursAgo = Math.floor(minutesAgo / 60);
                const daysAgo = Math.floor(hoursAgo / 24);
                
                let timeAgoText = '';
                if (daysAgo > 0) {
                  timeAgoText = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
                } else if (hoursAgo > 0) {
                  timeAgoText = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
                } else {
                  timeAgoText = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
                }
                
                return (
                  <div key={session.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {session.type === 'mock-test' || session.type === 'assessment' ? (
                            <ClipboardCheck className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Edit className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 mb-1">{session.title}</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                            <span className="capitalize">{session.type.replace('-', ' ')}</span>
                            <span>•</span>
                            <span>Question {currentQuestion} of {totalQuestions}</span>
                            <span>•</span>
                            <span>{pointsEarned} points earned</span>
                          </div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>{progressPercentage}% complete ({questionsAnswered}/{totalQuestions} answered)</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Started</div>
                          <div className="text-sm font-medium text-gray-900">{timeAgoText}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="inline-flex items-center justify-center w-10 h-10 border border-transparent rounded-lg text-red-600 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                            title="Delete session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              handleResumeQuiz(session.id);
                            }}
                            className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>Resume</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quiz Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {quizOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <div
                key={option.id}
                className={`relative ${option.bgColor} ${option.borderColor} border-2 rounded-xl p-6 transition-all duration-200 ${
                  option.disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : `${option.hoverColor} cursor-pointer hover:shadow-lg hover:scale-105`
                }`}
                onClick={option.disabled ? undefined : option.onClick}
                title={option.tooltip}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`${option.color} p-3 rounded-lg`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  {option.disabled && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                      Upgrade Required
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {option.title}
                </h3>
                
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                  {option.description}
                </p>
                
                <ul className="space-y-1 mb-6">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <button
                  className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    option.disabled
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : `${option.color} text-white hover:opacity-90`
                  }`}
                  disabled={option.disabled}
                >
                  {option.action}
                </button>
              </div>
            );
          })}
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
                Recent Quiz Activity
              </h2>
              <span className="text-sm text-gray-500">
                {totalActivitiesCount} total sessions
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">Loading recent activities...</span>
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No quiz history yet</h3>
                <p className="text-gray-600 mb-4">
                  Start your first quiz to see your progress and performance here.
                </p>
                <button
                  onClick={() => navigate('/quiz/quick-start')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={!user?.planSettings?.allow_quick_start_quiz}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Start Your First Quiz
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{activity.title}</h4>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>Score: {activity.score}/{activity.maxScore}</span>
                          <span>Accuracy: {calculateAccuracy(activity.score, activity.maxScore)}%</span>
                          <span>Duration: {formatDuration(activity.duration)}</span>
                          <span>
                            {new Date(activity.completedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          calculateAccuracy(activity.score, activity.maxScore) >= 80
                            ? 'bg-green-100 text-green-800'
                            : calculateAccuracy(activity.score, activity.maxScore) >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {calculateAccuracy(activity.score, activity.maxScore)}%
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>{activity.duration}m</div>
                          {activity.approvalStatus && (activity.type === 'mock-test' || activity.type === 'assessment') && (
                            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              activity.approvalStatus === 'approved' 
                                ? 'bg-green-100 text-green-800'
                                : activity.approvalStatus === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.approvalStatus}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalActivitiesCount)} of {totalActivitiesCount} results
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Quiz Session</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this quiz session? This action cannot be undone.
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-4 mt-4">
                  <button
                    onClick={() => {
                      setShowDeleteConfirmModal(false);
                      setSessionToDeleteId(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}