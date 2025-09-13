import React from 'react';
import { CheckCircle, Flag, ArrowLeft, Award, Target, Clock } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

interface TestReviewConfirmationProps {
  type: 'success' | 'info';
  message: string;
  data: any; // Can be QuizStats or { challengedCount: number }
  onBackToQuizCenter: () => void;
}

export function TestReviewConfirmation({ type, message, data, onBackToQuizCenter }: TestReviewConfirmationProps) {
  const isSuccess = type === 'success';
  const isChallenge = type === 'info';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6 ${
          isSuccess ? 'bg-green-100' : 'bg-blue-100'
        }`}>
          {isSuccess ? (
            <CheckCircle className="w-8 h-8 text-green-600" />
          ) : (
            <Flag className="w-8 h-8 text-blue-600" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{message}</h1>

        {isSuccess && data && (
          <div className="space-y-4 mb-8">
            <p className="text-gray-600">Your results have been finalized.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xl font-bold text-gray-900">{data.accuracy}%</div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xl font-bold text-gray-900">{data.totalPointsEarned}</div>
                <div className="text-sm text-gray-600">Points Earned</div>
              </div>
            </div>
            <p className="text-sm text-gray-500">XP and achievements will be awarded shortly.</p>
          </div>
        )}

        {isChallenge && data && (
          <div className="space-y-4 mb-8">
            <p className="text-gray-600">
              Your challenge for {data.challengedCount} question{data.challengedCount !== 1 ? 's' : ''} has been submitted.
            </p>
            <p className="text-sm text-gray-500">
              Your team administrator will review your challenge and finalize your results.
            </p>
          </div>
        )}

        <button
          onClick={onBackToQuizCenter}
          className="inline-flex items-center space-x-2 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Quiz Center</span>
        </button>
      </div>
    </div>
  );
}