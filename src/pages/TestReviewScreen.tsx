import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuizSession } from '../contexts/QuizSessionContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AlertMessage } from '../components/common/AlertMessage';
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Flag,
  Save,
  Award,
  AlertTriangle,
  BookOpen,
  Target,
  Clock
} from 'lucide-react';
import { QuizSession, QuizResult } from '../types';
import { TestReviewConfirmation } from '../components/quiz/TestReviewConfirmation';

interface QuestionReview {
  questionId: string;
  question: any;
  userAnswer: string;
  autoGradedPoints: number;
  manualPoints: number;
  maxPoints: number;
  isChallenged: boolean;
  timeSpent: number;
}

export function TestReviewScreen() {
  const { quizSessionId } = useParams<{ quizSessionId: string }>();
  const navigate = useNavigate();
  const { user, developerLog } = useAuth();
  const { loadQuizSessionAsync, updateQuizSession } = useQuizSession();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionReviews, setQuestionReviews] = useState<QuestionReview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // State for confirmation page
  const [showConfirmationPage, setShowConfirmationPage] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'success' | 'info'>('success');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationData, setConfirmationData] = useState<any>(null);

  useEffect(() => {
    if (!quizSessionId || !user) {
      setError('Invalid test session');
      setLoading(false);
      return;
    }

    loadTestSession();
  }, [quizSessionId, user]);

  const loadTestSession = async () => {
    if (!quizSessionId) return;

    try {
      setLoading(true);
      setError(null);

      const loadedSession = await loadQuizSessionAsync(quizSessionId);
      
      if (!loadedSession) {
        setError('Test session not found');
        return;
      }

      if (loadedSession.status !== 'completed') {
        setError('Test session is not completed yet');
        return;
      }

      if (!loadedSession.is_temporary_result) {
        setError('This test has already been finalized');
        return;
      }

      developerLog('✅ Test session loaded for review:', loadedSession);
      setSession(loadedSession);

      // Initialize question reviews from session data
      const reviews: QuestionReview[] = loadedSession.questions.map((question, index) => {
        const result = loadedSession.results[index];
        return {
          questionId: question.id,
          question: question,
          userAnswer: result?.typedAnswer || '',
          autoGradedPoints: result?.pointsEarned || 0,
          manualPoints: result?.pointsEarned || 0, // Start with auto-graded points
          maxPoints: question.points,
          isChallenged: false,
          timeSpent: result?.timeSpent || 0
        };
      });

      setQuestionReviews(reviews);
    } catch (error) {
      console.error('Error loading test session:', error);
      setError('Failed to load test session');
    } finally {
      setLoading(false);
    }
  };

  // Manual point selection is removed for challenge flow; reviewers decide later
  const handlePointsChange = (_questionIndex: number, _newPoints: number) => {
    return;
  };

  const handleChallengeToggle = (questionIndex: number) => {
    setQuestionReviews(prev => prev.map((review, index) => 
      index === questionIndex 
        ? { ...review, isChallenged: !review.isChallenged }
        : review
    ));
  };

  const handleAcceptResults = async () => {
    if (!session || !user) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Calculate current stats before finalizing
      const currentStats = {
        totalPointsEarned: calculateTotalScore(),
        totalPossiblePoints: calculateMaxScore(),
        accuracy: calculateAccuracy(),
        correctAnswers: questionReviews.filter(r => r.autoGradedPoints === r.maxPoints).length,
        totalQuestions: questionReviews.length,
        averageTime: questionReviews.length > 0 
          ? Math.round(questionReviews.reduce((sum, r) => sum + r.timeSpent, 0) / questionReviews.length)
          : 0
      };

      // Finalize results without manual point selection here; acceptance locks in auto-graded points
      await updateQuizSession(session.id, {
        is_temporary_result: false,
      });

      setConfirmationData(currentStats);
      setShowConfirmationPage(true);
      setConfirmationType('success');
      setConfirmationMessage('Results Accepted!');

      // Don't navigate immediately, let the confirmation page handle it

    } catch (error) {
      console.error('Error accepting results:', error);
      setSubmitError('Failed to accept results. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitChallenge = async () => {
    if (!session || !user) return;

    const challengedQuestions = questionReviews.filter(review => review.isChallenged);
    
    if (challengedQuestions.length === 0) {
      setSubmitError('Please flag at least one question to challenge, or accept the current results.');
      return;
    }

    console.log('🔍 TestReviewScreen: handleSubmitChallenge called with:', {
      sessionId: session.id,
      userId: user.id,
      challengedQuestionsCount: challengedQuestions.length,
      challengedQuestionIds: challengedQuestions.map(q => q.questionId)
    });
    
    console.log('🔍 TestReviewScreen: About to update review_status for challenged questions:', {
      sessionId: session.id,
      challengedQuestionIds: challengedQuestions.map(q => q.questionId),
      challengedQuestionsData: challengedQuestions.map(q => ({
        questionId: q.questionId,
        isChallenged: q.isChallenged,
        autoGradedPoints: q.autoGradedPoints,
        maxPoints: q.maxPoints
      }))
    });
    
    try {
      setSubmitting(true);
      setSubmitError(null);

      const challengedCount = challengedQuestions.length;

      // Update session with challenge status only; keep current points as-is
      console.log('🔍 TestReviewScreen: Updating session challenge_status to pending_review');
      await updateQuizSession(session.id, {
        challenge_status: 'pending_review'
      });

      // Update individual question logs for challenged questions
      for (const review of challengedQuestions) {
        console.log('🔍 TestReviewScreen: Updating question log for question:', review.questionId, 'to challenged status');
        console.log('🔍 TestReviewScreen: About to update quiz_question_logs with:', {
          sessionId: session.id,
          questionId: review.questionId,
          newReviewStatus: 'challenged'
        });
        
        try {
          const { data: updatedRow, error } = await supabase
            .from('quiz_question_logs')
            .update({ review_status: 'challenged' })
            .eq('quiz_session_id', session.id)
            .eq('question_id', review.questionId)
            .eq('user_id', user.id)
            .select('review_status')
            .maybeSingle();

          if (error) {
            console.error('❌ TestReviewScreen: Error updating question log for question:', review.questionId, error);
            console.error('❌ TestReviewScreen: Detailed error info:', {
              error: error,
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            });
            console.error('Error updating question log:', error);
          } else {
            console.log('✅ TestReviewScreen: Successfully updated question log for question:', review.questionId);
            
            // Verify the update worked by querying the database
            const { data: verifyData, error: verifyError } = await supabase
              .from('quiz_question_logs')
              .select('review_status')
              .eq('quiz_session_id', session.id)
              .eq('question_id', review.questionId)
              .eq('user_id', user.id)
              .single();
            
            if (verifyError) {
              console.error('❌ TestReviewScreen: Error verifying update for question:', review.questionId, verifyError);
            } else {
              console.log('✅ TestReviewScreen: Verified update - review_status is now:', verifyData?.review_status || updatedRow?.review_status);
            }
          }
        } catch (error) {
          console.error('💥 TestReviewScreen: Exception updating question log for question:', review.questionId, error);
          console.error('Error updating question log:', error);
        }
      }

      console.log('✅ TestReviewScreen: All challenge updates completed successfully');
      
      setConfirmationData({ challengedCount });
      setShowConfirmationPage(true);
      setConfirmationType('info');
      setConfirmationMessage('Challenge Submitted!');

    } catch (error) {
      console.error('💥 TestReviewScreen: Error in handleSubmitChallenge:', error);
      console.error('Error submitting challenge:', error);
      setSubmitError('Failed to submit challenge. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalScore = () => {
    // Show auto-graded score; reviewer will decide final points during admin review
    return questionReviews.reduce((sum, review) => sum + review.autoGradedPoints, 0);
  };

  const calculateMaxScore = () => {
    return questionReviews.reduce((sum, review) => sum + review.maxPoints, 0);
  };

  const calculateAccuracy = () => {
    const totalScore = calculateTotalScore();
    const maxScore = calculateMaxScore();
    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  };

  const getChallengedCount = () => {
    return questionReviews.filter(review => review.isChallenged).length;
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner fullScreen text="Loading test review..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <div className="max-w-2xl mx-auto text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/quiz')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              Back to Quiz Center
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (showConfirmationPage) {
    return (
      <Layout>
        <TestReviewConfirmation
          type={confirmationType}
          message={confirmationMessage}
          data={confirmationData}
          onBackToQuizCenter={() => navigate('/quiz')}
        />
      </Layout>
    );
  }

  if (!session) return null;

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/quiz')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Quiz Center</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Review Test Results</h1>
                <p className="text-gray-600">{session.title}</p>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-900">{calculateTotalScore()}</div>
                <div className="text-sm text-blue-700">Current Score</div>
                <div className="text-xs text-blue-600">of {calculateMaxScore()} possible</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-900">{calculateAccuracy()}%</div>
                <div className="text-sm text-green-700">Accuracy</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-900">{questionReviews.length}</div>
                <div className="text-sm text-purple-700">Questions</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-900">{getChallengedCount()}</div>
                <div className="text-sm text-yellow-700">Challenged</div>
              </div>
            </div>

            {/* Error Message */}
            {submitError && (
              <AlertMessage
                type="error"
                message={submitError}
                className="mb-6"
                dismissible
                onDismiss={() => setSubmitError(null)}
              />
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Review Instructions:</p>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Review each question and adjust points if needed (0 to max points)</li>
                    <li>• Flag questions you want to challenge for admin review</li>
                    <li>• Accept results to finalize and receive XP, or submit challenges for admin review</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Questions Review */}
          <div className="space-y-6">
            {questionReviews.map((review, index) => (
              <div key={review.questionId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {review.question.book_of_bible} Chapter {review.question.chapter}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>{review.maxPoints} points</span>
                        <span>•</span>
                        <span>{review.timeSpent}s</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleChallengeToggle(index)}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      review.isChallenged
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Flag className="h-4 w-4" />
                    <span>{review.isChallenged ? 'Challenged' : 'Challenge'}</span>
                  </button>
                </div>

                {/* Question */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Question:</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-900">{review.question.question}</p>
                  </div>
                </div>

                {/* User's Answer */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Your Answer:</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-900">{review.userAnswer || 'No answer provided'}</p>
                  </div>
                </div>

                {/* Correct Answer */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-900 font-medium">{review.question.answer}</p>
                  </div>
                </div>

                {/* Points Assignment */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Points Assignment:</h4>
                      <p className="text-xs text-gray-600">
                        Auto-graded: {review.autoGradedPoints} / {review.maxPoints} points
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600">Auto-graded: {review.autoGradedPoints} / {review.maxPoints}</span>
                      <span className="text-xs text-gray-500">(Final points decided by reviewer)</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleAcceptResults}
                disabled={submitting}
                className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    <span>Accept Results & Get XP</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleSubmitChallenge}
                disabled={submitting || getChallengedCount() === 0}
                className="flex items-center justify-center space-x-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-5 w-5" />
                    <span>Submit Challenge ({getChallengedCount()} questions)</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Current score: {calculateTotalScore()} / {calculateMaxScore()} points ({calculateAccuracy()}% accuracy)
              </p>
              {getChallengedCount() > 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  {getChallengedCount()} question{getChallengedCount() !== 1 ? 's' : ''} flagged for challenge
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}