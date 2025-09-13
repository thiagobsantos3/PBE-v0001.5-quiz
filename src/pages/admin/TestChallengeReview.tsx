import React, { useState } from 'react';
import { useTestChallenges } from '../../hooks/useTestChallenges';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertMessage } from '../../components/common/AlertMessage';
import { Table, TableColumn } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { formatTimeAgo } from '../../utils/formatters';
import {
  Flag,
  Eye,
  CheckCircle,
  XCircle, 
  Clock,
  Target,
  Award,
  BookOpen,
  User,
  AlertTriangle,
  Save
} from 'lucide-react';

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

export function TestChallengeReview() {
  const { 
    challengedSessions, 
    setChallengedSessions,
    loading, 
    error, 
    getChallengedQuestions, 
    resolveChallenge 
  } = useTestChallenges();

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionTitle, setSelectedSessionTitle] = useState<string>('');
  const [challengedQuestions, setChallengedQuestions] = useState<QuestionChallenge[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionPoints, setQuestionPoints] = useState<Record<string, number>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const handleReviewChallenge = async (sessionId: string, sessionTitle: string) => {
    try {
      setSelectedSessionId(sessionId);
      setSelectedSessionTitle(sessionTitle);
      setLoadingQuestions(true);
      setShowReviewModal(true);
      setResolveError(null);

      const questions = await getChallengedQuestions(sessionId);
      setChallengedQuestions(questions);

      // Initialize points with auto-graded values
      const initialPoints: Record<string, number> = {};
      questions.forEach(q => {
        initialPoints[q.question_id] = q.auto_graded_points;
      });
      setQuestionPoints(initialPoints);

    } catch (err: any) {
      console.error('Error loading challenged questions:', err);
      setResolveError('Failed to load challenged questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handlePointsChange = (questionId: string, newPoints: number) => {
    setQuestionPoints(prev => ({
      ...prev,
      [questionId]: newPoints
    }));
  };

  const handleResolveQuestion = async (questionId: string, resolution: 'approved' | 'rejected') => {
    if (!selectedSessionId) return;

    try {
      setResolving(questionId);
      setResolveError(null);

      const finalPoints = resolution === 'approved' ? questionPoints[questionId] : 0;
      const result = await resolveChallenge(selectedSessionId, questionId, finalPoints, resolution);

      if (!result.success) {
        setResolveError('Failed to resolve challenge. Please try again.');
        return;
      }

      // Remove the resolved question from the list
      setChallengedQuestions(prev => prev.filter(q => q.question_id !== questionId));

      // Update the main challenged sessions list to reflect the change
      setChallengedSessions(prev => prev.map(session => {
        if (session.id === selectedSessionId) {
          const updatedSession = {
            ...session,
            challenged_questions_count: session.challenged_questions_count - 1
          };
          
          // If all challenges are resolved, update the session status
          if (result.allChallengesResolved) {
            updatedSession.challenge_status = 'resolved_approved';
            if (result.newTotalPoints !== undefined) {
              updatedSession.total_points = result.newTotalPoints;
            }
          }
          
          return updatedSession;
        }
        return session;
      }));

      // If no more questions, close the modal
      if (challengedQuestions.length <= 1) {
        setShowReviewModal(false);
        setSelectedSessionId(null);
        setChallengedQuestions([]);
        setQuestionPoints({});
      }

    } catch (err: any) {
      console.error('Error resolving challenge:', err);
      setResolveError(err.message || 'Failed to resolve challenge');
    } finally {
      setResolving(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'resolved_approved':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'resolved_rejected':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSuspicionColor = (status?: string) => {
    switch (status) {
      case 'red':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'amber':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'green':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const columns: TableColumn[] = [
    {
      key: 'title',
      header: 'Test Title',
      render: (session) => (
        <div>
          <div className="font-medium text-gray-900">{session.title}</div>
          <div className="text-sm text-gray-600 capitalize">{session.type.replace('-', ' ')}</div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Student',
      render: (session) => (
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-indigo-600">
              {session.user_name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <span className="font-medium text-gray-900">{session.user_name}</span>
        </div>
      ),
    },
    {
      key: 'completed_at',
      header: 'Completed',
      render: (session) => (
        <div className="text-sm text-gray-600">
          {new Date(session.completed_at).toLocaleDateString()}
          <div className="text-xs text-gray-500">
            {formatTimeAgo(session.completed_at)}
          </div>
        </div>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'score',
      header: 'Score',
      render: (session) => {
        const accuracy = session.max_points > 0 ? Math.round((session.total_points / session.max_points) * 100) : 0;
        const scoreColor = accuracy >= 90 ? 'text-green-600' : accuracy >= 70 ? 'text-blue-600' : 'text-red-600';
        return (
          <div className="text-center">
            <div className={`font-bold text-lg ${scoreColor}`}>
              {accuracy}%
            </div>
            <div className="text-xs text-gray-500">
              {session.total_points}/{session.max_points}
            </div>
          </div>
        );
      },
      className: 'text-center',
    },
    {
      key: 'challenged_questions',
      header: 'Challenged',
      render: (session) => (
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1">
            <Flag className="h-4 w-4 text-orange-600" />
            <span className="font-medium text-gray-900">{session.challenged_questions_count}</span>
          </div>
          <div className="text-xs text-gray-500">
            of {session.total_questions} questions
          </div>
        </div>
      ),
      className: 'text-center',
    },
    {
      key: 'suspicion',
      header: 'Integrity',
      render: (session) => (
        <div className="text-center">
          {session.suspicion_status ? (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSuspicionColor(session.suspicion_status)}`}>
              <span className={`h-2 w-2 rounded-full mr-1 ${
                session.suspicion_status === 'red' ? 'bg-red-500' :
                session.suspicion_status === 'amber' ? 'bg-yellow-500' : 'bg-green-500'
              }`}></span>
              <span className="capitalize">{session.suspicion_status}</span>
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
      className: 'text-center',
    },
    {
      key: 'status',
      header: 'Status',
      render: (session) => (
        <div className="text-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(session.challenge_status)}`}>
            {session.challenge_status === 'pending_review' && <Clock className="h-3 w-3 mr-1" />}
            {session.challenge_status === 'resolved_approved' && <CheckCircle className="h-3 w-3 mr-1" />}
            {session.challenge_status === 'resolved_rejected' && <XCircle className="h-3 w-3 mr-1" />}
            <span className="capitalize">{session.challenge_status.replace('_', ' ')}</span>
          </span>
        </div>
      ),
      className: 'text-center',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (session) => (
        <div className="text-center">
          <button
            onClick={() => handleReviewChallenge(session.id, session.title)}
            disabled={session.challenge_status !== 'pending_review'}
            className="flex items-center space-x-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="h-3 w-3" />
            <span>Review</span>
          </button>
        </div>
      ),
      className: 'text-center',
    },
  ];

  if (loading) {
    return (
      <LoadingSpinner fullScreen text="Loading test challenges..." />
    );
  }

  return (
    <div className="p-4 sm:p-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Test Challenge Review</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Review and resolve challenged mock test and test assignment results.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <AlertMessage
            type="error"
            message={error}
            className="mb-6"
          />
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <Flag className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Challenges</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{challengedSessions.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {challengedSessions.filter(s => s.challenge_status === 'pending_review').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {challengedSessions.filter(s => s.challenge_status.startsWith('resolved')).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <Target className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Questions</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {challengedSessions.reduce((sum, s) => sum + s.challenged_questions_count, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Challenged Sessions Table */}
        <Table
          columns={columns}
          data={challengedSessions}
          loading={loading}
          emptyState={{
            icon: Flag,
            title: "No Test Challenges",
            description: "No test challenges have been submitted yet. Students can challenge their mock test results for manual review.",
          }}
        />

        {/* Challenge Review Modal */}
        <Modal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedSessionId(null);
            setChallengedQuestions([]);
            setQuestionPoints({});
            setResolveError(null);
          }}
          title={`Review Challenge: ${selectedSessionTitle}`}
          maxWidth="4xl"
          footer={
            <button
              onClick={() => {
                setShowReviewModal(false);
                setSelectedSessionId(null);
                setChallengedQuestions([]);
                setQuestionPoints({});
                setResolveError(null);
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              Close
            </button>
          }
        >
          {loadingQuestions ? (
            <LoadingSpinner text="Loading challenged questions..." className="py-8" />
          ) : (
            <div className="space-y-6">
              {resolveError && (
                <AlertMessage
                  type="error"
                  message={resolveError}
                  dismissible
                  onDismiss={() => setResolveError(null)}
                />
              )}

              {challengedQuestions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Challenges Resolved</h3>
                  <p className="text-gray-600">
                    All challenged questions for this test have been reviewed and resolved.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Review Instructions:</p>
                        <ul className="space-y-1 text-blue-700">
                          <li>• Review each challenged question and the student's typed answer</li>
                          <li>• Adjust points from 0 to the maximum points for the question</li>
                          <li>• Click "Approve" to accept the adjusted points or "Reject" to award 0 points</li>
                          <li>• Once all questions are resolved, the student will receive their final score and XP</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {challengedQuestions.map((question, index) => (
                    <div key={question.question_id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-orange-600">{index + 1}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {question.book_of_bible} Chapter {question.chapter}
                            </h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <span>Max: {question.max_points} points</span>
                              <span>•</span>
                              <span>Time: {question.time_spent}s</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Auto-graded: {question.auto_graded_points}</span>
                        </div>
                      </div>

                      {/* Question */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Question:</h4>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-gray-900">{question.question_text}</p>
                        </div>
                      </div>

                      {/* Student's Answer */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Student's Answer:</h4>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-blue-900">{question.user_typed_answer || 'No answer provided'}</p>
                        </div>
                      </div>

                      {/* Correct Answer */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</h4>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-green-900 font-medium">{question.answer_text}</p>
                        </div>
                      </div>

                      {/* Points Assignment and Actions */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Award Points:
                              </label>
                              <select
                                value={questionPoints[question.question_id] || 0}
                                onChange={(e) => handlePointsChange(question.question_id, parseInt(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
                                disabled={resolving === question.question_id}
                              >
                                {Array.from({ length: question.max_points + 1 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {i} point{i !== 1 ? 's' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="text-sm text-gray-600">
                              <div>Auto-graded: {question.auto_graded_points}</div>
                              <div>Manual: {questionPoints[question.question_id] || 0}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleResolveQuestion(question.question_id, 'rejected')}
                              disabled={resolving === question.question_id}
                              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                              {resolving === question.question_id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              <span>Reject (0 pts)</span>
                            </button>
                            
                            <button
                              onClick={() => handleResolveQuestion(question.question_id, 'approved')}
                              disabled={resolving === question.question_id}
                              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                              {resolving === question.question_id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              <span>Approve ({questionPoints[question.question_id] || 0} pts)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
  );
}