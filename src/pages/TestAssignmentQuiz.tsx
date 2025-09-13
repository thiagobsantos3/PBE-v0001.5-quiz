import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuestion } from '../contexts/QuestionContext';
import { useQuizSession } from '../contexts/QuizSessionContext';
import { useTestAssignments } from '../hooks/useTestAssignments';
import { TestRunner } from './TestRunner';
import { Layout } from '../components/layout/Layout';
import { 
  ArrowLeft,
  ClipboardCheck,
  Play,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  Users
} from 'lucide-react';
import { TestAssignment, Question } from '../types';
import { getAccessibleQuestions, filterQuestionsByStudyItems } from '../utils/quizUtils';
import { formatStudyItemsForAssignment } from '../utils/quizHelpers';

export function TestAssignmentQuiz() {
  const { testAssignmentId } = useParams<{ testAssignmentId: string }>();
  const navigate = useNavigate();
  const { user, developerLog } = useAuth();
  const { questions } = useQuestion();
  const { assignments, assignmentMembers, loading: testAssignmentsLoading, getAssignmentById, getQuizSessionForTestAssignment } = useTestAssignments();
  const { 
    createQuizSession, 
    getSessionForAssignment
  } = useQuizSession();

  const [assignment, setAssignment] = useState<TestAssignment | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if user does not have access to test assignments
  useEffect(() => {
    if (!user) return; // Wait for user to load
    if (user.planSettings && !user.planSettings.allow_test_assignments) {
      navigate('/quiz', { replace: true });
    }
  }, [user, navigate]);

  // Memoized questions for rendering purposes - must be at top level
  const currentAssignmentQuestions = React.useMemo(() => {
    return assignment?.test_questions || [];
  }, [assignment]);

  // Calculate estimated minutes and max points for display
  const displayEstimatedMinutes = React.useMemo(() => {
    return Math.round(currentAssignmentQuestions.reduce((sum, q) => sum + q.time_to_answer, 0) / 60);
  }, [currentAssignmentQuestions]);

  const displayMaxPoints = React.useMemo(() => {
    return currentAssignmentQuestions.reduce((sum, q) => sum + q.points, 0);
  }, [currentAssignmentQuestions]);

  const handleStartTest = React.useCallback(async () => {
    if (!assignment || !user) {
      setError('Test assignment data is missing.');
      return;
    }

    // Check for existing quiz session for this test assignment
    const existingQuizSession = getQuizSessionForTestAssignment(testAssignmentId!, user.id);
    
    if (existingQuizSession) {
      if (existingQuizSession.status === 'completed') {
        setError('You have already completed this assessment. Only one attempt is allowed per assessment.');
        return;
      } else if (existingQuizSession.status === 'active' || existingQuizSession.status === 'paused') {
        // Resume existing session
        navigate(`/quiz/test-runner/${existingQuizSession.id}`);
        return;
      }
    }

    // Use the pre-allocated questions from the test_questions column
    const assignmentQuestions = assignment.test_questions;

    if (!assignmentQuestions || assignmentQuestions.length === 0) {
      setError('No questions found for this test assignment. Please contact your administrator.');
      return;
    }

    // Calculate quiz metadata
    const totalPoints = assignmentQuestions.reduce((sum, q) => sum + q.points, 0);
    const estimatedMinutes = Math.round(assignmentQuestions.reduce((sum, q) => sum + q.time_to_answer, 0) / 60); // Keep this calculation

    // Create new quiz session for test
    try {
      const sessionId = await createQuizSession({ 
        type: 'assessment',
        title: assignment.title,
        description: assignment.description || 'Formal test assignment',
        user_id: user.id,
        team_id: user.teamId,
        test_assignment_id: assignment.id,
        questions: assignmentQuestions,
        current_question_index: 0,
        results: [],
        status: 'active',
        show_answer: false,
        time_left: assignmentQuestions[0]?.time_to_answer || 30,
        timer_active: false,
        timer_started: false,
        has_time_expired: false,
        challenge_status: 'none',
        is_temporary_result: true, // Mark as temporary for review process
      });

      setQuizSessionId(sessionId);
      
      // Navigate to TestRunner with the session ID
      navigate(`/quiz/test-runner/${sessionId}`);
    } catch (error) {
      console.error('Error creating test quiz session:', error);
      setError('Failed to create test session');
    }
  }, [assignment, user, createQuizSession]);

  const handleSessionDeleted = React.useCallback(() => {
    setQuizSessionId(null);
  }, []);

  // Wait for test assignments to load, then find the assignment
  useEffect(() => {
    developerLog('🔍 TestAssignmentQuiz useEffect triggered:', {
      testAssignmentId,
      hasUser: !!user,
      userId: user?.id,
      testAssignmentsLoading,
      assignmentsLength: assignments.length,
      assignmentMembersLength: assignmentMembers.length
    });

    if (!testAssignmentId || !user || testAssignmentsLoading) {
      developerLog('⏳ TestAssignmentQuiz: Waiting for data...', {
        hasTestAssignmentId: !!testAssignmentId,
        hasUser: !!user,
        testAssignmentsLoading
      });
      return;
    }

    // Additional check to ensure data arrays are populated
    if (assignments.length === 0 || assignmentMembers.length === 0) {
      developerLog('⏳ TestAssignmentQuiz: Data arrays not yet populated, waiting...', {
        assignmentsLength: assignments.length,
        assignmentMembersLength: assignmentMembers.length
      });
      return;
    }

    developerLog('🔍 TestAssignmentQuiz: About to search for assignment with data:', {
      searchingForId: testAssignmentId,
      assignmentsArray: assignments.map(a => ({ id: a.id, title: a.title, is_active: a.is_active })),
      assignmentMembersArray: assignmentMembers.map(m => ({ 
        test_assignment_id: m.test_assignment_id, 
        user_id: m.user_id, 
        status: m.status 
      })),
      userAssignments: assignmentMembers.filter(m => m.user_id === user.id)
    });

    console.log('🔍 TestAssignmentQuiz: Assignments loaded, searching for assignment:', testAssignmentId);
    console.log('📊 Available assignments:', assignments.map(a => ({ id: a.id, title: a.title })));
    console.log('📊 Assignment members for user:', assignmentMembers.filter(m => m.user_id === user.id));

    // Now that test assignments are loaded, try to find the assignment
    const assignmentData = getAssignmentById(testAssignmentId);
    
    if (!assignmentData) {
      developerLog('❌ TestAssignmentQuiz: getAssignmentById returned null for:', testAssignmentId);
      console.log('❌ Test assignment not found in loaded assignments:', testAssignmentId);
      console.log('📊 Available assignments:', assignments.map(a => ({ id: a.id, title: a.title })));
      console.log('📊 Assignment members for user:', assignmentMembers.filter(m => m.user_id === user.id));
      
      // Enhanced error message with debugging info
      const userAssignmentIds = assignmentMembers
        .filter(m => m.user_id === user.id)
        .map(m => m.test_assignment_id);
      
      const availableAssignmentIds = assignments
        .filter(a => a.is_active)
        .map(a => a.id);
      
      console.log('🔍 Debug info:', {
        searchingForId: testAssignmentId,
        userAssignmentIds,
        availableAssignmentIds,
        isUserAssigned: userAssignmentIds.includes(testAssignmentId),
        isAssignmentActive: availableAssignmentIds.includes(testAssignmentId)
      });

      developerLog('🔍 TestAssignmentQuiz: Debug info for failed lookup:', {
        searchingForId: testAssignmentId,
        userAssignmentIds,
        availableAssignmentIds,
        isUserAssigned: userAssignmentIds.includes(testAssignmentId),
        isAssignmentActive: availableAssignmentIds.includes(testAssignmentId)
      });
      
      if (!userAssignmentIds.includes(testAssignmentId)) {
        setError('This test assignment is not assigned to you. Please check with your team administrator.');
      } else if (!availableAssignmentIds.includes(testAssignmentId)) {
        setError('This test assignment is not active. Please contact your team administrator.');
      } else {
        setError('Test assignment not found. Please try refreshing the page or contact support.');
      }
      setLoading(false);
      return;
    }

    console.log('✅ Test assignment found:', assignmentData);
    developerLog('✅ TestAssignmentQuiz: Assignment found successfully:', {
      assignmentId: assignmentData.id,
      title: assignmentData.title,
      isActive: assignmentData.is_active
    });
    setAssignment(assignmentData);


    setLoading(false);
  }, [testAssignmentId, user, testAssignmentsLoading, assignments, assignmentMembers, getAssignmentById, developerLog]);

  // Separate useEffect to handle loading state based on testAssignmentsLoading
  useEffect(() => {
    setLoading(testAssignmentsLoading);
  }, [testAssignmentsLoading]);

  // Separate useEffect for the old logic (now removed)
  /*
  useEffect(() => {
    if (!assignmentId || !user || testAssignmentsLoading) {
      if (!assignmentId || !user) {
        setError('Test assignment not found');
        setLoading(false);
      }
      // If testAssignmentsLoading is true, keep loading state and wait
      return;
    }

    // Now that test assignments are loaded, try to find the assignment
    const assignmentData = getAssignmentById(assignmentId);
    
    if (!assignmentData) {
      console.log('❌ Test assignment not found in loaded assignments:', assignmentId);
      console.log('📊 Available assignments:', assignments.map(a => ({ id: a.id, title: a.title })));
      console.log('📊 Assignment members for user:', assignmentMembers.filter(m => m.user_id === user.id));
      setError('Test assignment not found or you do not have access to this test');
      setLoading(false);
      return;
    }

    console.log('✅ Test assignment found:', assignmentData);
    setAssignment(assignmentData);

    // Check for existing quiz session for this test assignment
    const existingSession = getSessionForAssignment(assignmentId, user.id);
    if (existingSession) {
      setQuizSessionId(existingSession.id);
    }

    setLoading(false);
  }, [assignmentId, user, testAssignmentsLoading, assignments, assignmentMembers, getAssignmentById, getSessionForAssignment]);
  */

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading test assignment...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50"> {/* This layout is correct */}
          <div className="p-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => navigate('/quiz/test-assignments')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Assessments</span>
                </button>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => navigate('/quiz/test-assignments')}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                >
                  Return to Assessment
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // If quiz session is active, render TestRunner
  if (quizSessionId) {
    // Navigation should have already occurred, but if we reach here, redirect
    navigate(`/quiz/test-runner/${quizSessionId}`);
    return null;
  }

  // Render test preparation screen
  if (!assignment) return null;

  const existingQuizSession = getQuizSessionForTestAssignment(testAssignmentId!, user!.id);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 sm:p-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center mb-6">
              <button
                onClick={() => navigate('/quiz/test-assignments')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Assessment</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <ClipboardCheck className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
                  <p className="text-gray-600">
                    {assignment.description || 'Formal test assignment'}
                  </p>
                </div>
              </div>

              {/* Test Details */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-red-900 mb-2">Test Assignment Details</h3>
                <div className="text-sm text-red-800 space-y-1">
                  <div><strong>Coverage:</strong> {formatStudyItemsForAssignment(assignment.study_items)}</div>
                  <div><strong>Maximum Questions:</strong> {assignment.max_questions}</div>
                  <div><strong>Created:</strong> {new Date(assignment.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Test Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">{currentAssignmentQuestions.length}</div>
                  <div className="text-sm text-gray-600">Questions</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">~{displayEstimatedMinutes}</div>
                  <div className="text-sm text-gray-600">Minutes</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">{displayMaxPoints}</div>
                  <div className="text-sm text-gray-600">Max Points</div>
                </div>
              </div>

              {currentAssignmentQuestions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No questions available</p>
                  <p className="text-sm text-gray-400">
                    There are no questions available for this test assignment with your current subscription tier.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {existingQuizSession?.status === 'completed' ? (
                    <>
                      {/* Assessment completed */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-2 text-green-800">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Assessment Completed</span>
                        </div>
                        <p className="text-green-700 text-sm mt-1">
                          You have already completed this assessment. Only one attempt is allowed per assessment.
                        </p>
                        <div className="mt-3 text-sm text-green-700">
                          <div>Score: {existingQuizSession.total_points} / {existingQuizSession.max_points} points</div>
                          <div>Completed: {new Date(existingQuizSession.completed_at).toLocaleDateString()}</div>
                          {existingQuizSession.approval_status && (
                            <div>Status: <span className="font-medium capitalize">{existingQuizSession.approval_status}</span></div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => navigate('/quiz/test-assignments')}
                        className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors duration-200"
                      >
                        <span>Back to Assessments</span>
                      </button>
                    </>
                  ) : existingQuizSession?.status === 'active' || existingQuizSession?.status === 'paused' ? (
                    <>
                      {/* Resume existing active session */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-2 text-yellow-800">
                          <Clock className="h-5 w-5" />
                          <span className="font-medium">Assessment in Progress</span>
                        </div>
                        <p className="text-yellow-700 text-sm mt-1">
                          You have an active assessment session. You can resume where you left off.
                        </p>
                      </div>
                      
                      <button
                        onClick={() => navigate(`/quiz/test-runner/${existingQuizSession.id}`)}
                        className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200"
                      >
                        <Play className="h-5 w-5" />
                        <span>Resume Assessment</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Start new assessment */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Important Assessment Instructions:</p>
                            <ul className="space-y-1 text-blue-700">
                              <li>• This is a formal assessment that will be reviewed by administrators</li>
                              <li>• You can only take this assessment once</li>
                              <li>• Answer all questions to the best of your ability</li>
                              <li>• Some answers may require manual review</li>
                              <li>• Results may be marked as temporary pending review</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleStartTest}
                        className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-200"
                      >
                        <Play className="h-5 w-5" />
                        <span>Start Assessment</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Test Coverage Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Coverage</h3>
              <div className="space-y-3">
                {assignment.study_items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{item.book}</div>
                      <div className="text-sm text-gray-600">
                        {item.verses && item.verses.length > 0 ? (
                          <>
                            <div>Chapters: {item.chapters.join(', ')}</div>
                            <div className="text-purple-600 font-medium">
                              Verses: {item.verses.join(', ')}
                            </div>
                          </>
                        ) : (
                          <div>Chapters: {item.chapters.join(', ')} (All verses)</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {(() => {
                        let itemQuestions = questions.filter(q => 
                          q.book_of_bible === item.book && item.chapters.includes(q.chapter)
                        );
                        
                        if (item.verses && item.verses.length > 0) {
                          itemQuestions = itemQuestions.filter(q => {
                            const questionVerse = q.verse || 1;
                            return item.verses!.includes(questionVerse);
                          });
                        }
                        
                        return itemQuestions.length;
                      })()} question{(() => {
                        let itemQuestions = questions.filter(q => 
                          q.book_of_bible === item.book && item.chapters.includes(q.chapter)
                        );
                        
                        if (item.verses && item.verses.length > 0) {
                          itemQuestions = itemQuestions.filter(q => {
                            const questionVerse = q.verse || 1;
                            return item.verses!.includes(questionVerse);
                          });
                        }
                        
                        const count = itemQuestions.length;
                        return count !== 1 ? 's' : '';
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}