import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Target, Award } from 'lucide-react';
import { useQuizSession } from '../../contexts/QuizSessionContext';

interface TestCompletionSummaryProps {
  quizSessionId: string;
  title: string;
  stats: {
    totalPointsEarned: number;
    totalPossiblePoints: number;
    accuracy: number;
    correctAnswers: number;
    totalQuestions: number;
    averageTime: number; // seconds
  };
  isTemporary: boolean;
  challengeStatus: 'none' | 'pending_review' | 'resolved_approved' | 'resolved_rejected';
  onBack: () => void;
}

export const TestCompletionSummary: React.FC<TestCompletionSummaryProps> = (
  props: TestCompletionSummaryProps
) => {
  const {
    quizSessionId,
    title,
    stats,
    isTemporary,
    challengeStatus,
    onBack
  } = props;
  const navigate = useNavigate();
  const { updateQuizSession } = useQuizSession();
  const [accepting, setAccepting] = useState(false);

  const safeStats = stats || {
    totalPointsEarned: 0,
    totalPossiblePoints: 0,
    accuracy: 0,
    correctAnswers: 0,
    totalQuestions: 0,
    averageTime: 0
  };

  const totalQuestions = safeStats.totalQuestions || 0;
  const correctAnswers = safeStats.correctAnswers || 0;
  const accuracy = safeStats.accuracy || 0;

  const totalTimeSeconds = Math.max(0, (safeStats.averageTime || 0) * (safeStats.totalQuestions || 0));
  const totalTimeMinutes = Math.ceil(totalTimeSeconds / 60);

  const handleChallengeResults = () => {
    navigate(`/quiz/test-review/${quizSessionId}`);
  };

  const handleAcceptResults = async () => {
    try {
      setAccepting(true);
      await updateQuizSession(quizSessionId, {
        is_temporary_result: false,
        challenge_status: 'none'
      } as any);
      navigate('/quiz', {
        state: {
          message: 'Test results accepted! XP and achievements have been awarded.',
          type: 'success'
        }
      });
    } catch (e) {
      console.error('Error accepting results:', e);
      navigate('/quiz', {
        state: {
          message: 'Failed to accept results. Please try again from the review page.',
          type: 'error'
        }
      });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <Trophy className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Completed!
          </h1>
          <p className="text-gray-800 font-medium">{title}</p>
          <p className="text-gray-600">
            Your provisional results are ready for review
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-900 mb-1">
              {safeStats.totalPointsEarned}
            </div>
            <div className="text-sm text-blue-600">
              Points Earned
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-900 mb-1">
              {accuracy}%
            </div>
            <div className="text-sm text-green-600">
              Accuracy
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-900 mb-1">
              {totalTimeMinutes}
            </div>
            <div className="text-sm text-purple-600">
              Minutes
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Trophy className="w-5 h-5 text-yellow-600 mt-0.5" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Provisional Results
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                These results are automatically graded. You can accept them to receive your XP immediately, 
                or challenge specific questions for manual review by your team admin.
              </p>
              <div className="mt-2 text-xs text-yellow-800">
                Status: <span className="font-semibold">{challengeStatus || 'none'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleAcceptResults}
            disabled={!isTemporary || accepting}
            className={`flex-1 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center ${isTemporary ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            <Award className="w-5 h-5 mr-2" />
            {accepting ? 'Processing...' : (isTemporary ? 'Accept Results & Get XP' : 'Results Finalized')}
          </button>
          
          <button
            onClick={handleChallengeResults}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            <Target className="w-5 h-5 mr-2" />
            Challenge Results
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Questions: {correctAnswers}/{totalQuestions} correct • 
            Max Possible: {safeStats.totalPossiblePoints} points
          </p>
          <button
            onClick={onBack}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 underline"
          >
            Back to Quiz Center
          </button>
        </div>
      </div>
    </div>
  );
};