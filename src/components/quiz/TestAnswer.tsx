import React, { memo } from 'react';
import { Question } from '../../types';

interface TestAnswerProps {
  question: Question;
  isFullScreen: boolean;
  isDarkMode: boolean;
  themeClasses: any;
  userTypedAnswer: string;
}

export function TestAnswer({ 
  question,
  isFullScreen,
  isDarkMode, 
  themeClasses,
  userTypedAnswer
}: TestAnswerProps) {
  return (
    <div className="text-center">
      <div className="mb-6 sm:mb-8">
        <div className={`font-medium mb-2 ${isFullScreen ? (isDarkMode ? 'text-blue-300' : 'text-[#1a255b]') : 'text-indigo-600'} ${isFullScreen ? 'text-[2.5vw]' : 'text-lg'}`}>
          {question.points} points
        </div>
        
        {/* Question */}
        <div className="mb-6">
          <div className={`text-sm ${themeClasses.textSecondary} mb-2 text-left`}>Question:</div>
          <div className={`font-semibold p-4 rounded-lg ${themeClasses.text} ${isFullScreen ? 'text-[2.5vw]' : 'text-lg'} text-left bg-gray-50 ${isFullScreen ? 'bg-white/10' : ''}`}>
            {question.question}
          </div>
        </div>

        {/* User's Typed Answer */}
        <div className="mb-6">
          <div className={`text-sm ${themeClasses.textSecondary} mb-2 text-left`}>Your Answer:</div>
          <div className={`p-4 rounded-lg border-2 ${isFullScreen ? 'border-blue-300 bg-blue-500/20' : 'border-blue-200 bg-blue-50'} text-left`}>
            <div className={`${isFullScreen ? 'text-blue-100' : 'text-blue-900'} ${isFullScreen ? 'text-[2vw]' : 'text-base'}`}>
              {userTypedAnswer || 'No answer provided'}
            </div>
          </div>
        </div>

        {/* Correct Answer */}
        <div className="mb-6">
          <div className={`text-sm ${themeClasses.textSecondary} mb-2 text-left`}>Correct Answer:</div>
          <div className={`p-4 rounded-lg border-2 ${isFullScreen ? 'border-green-300 bg-green-500/20' : 'border-green-200 bg-green-50'} text-left`}>
            <div className={`${isFullScreen ? 'text-green-100' : 'text-green-900'} ${isFullScreen ? 'text-[2vw]' : 'text-base'} font-semibold`}>
              {question.answer}
            </div>
          </div>
        </div>

        {/* Comparison Note */}
        <div className={`text-sm ${themeClasses.textSecondary} text-left p-3 rounded-lg ${isFullScreen ? 'bg-white/10' : 'bg-gray-100'}`}>
          <strong>Review:</strong> Compare your answer with the correct answer above. 
          Mark yourself as correct if your answer matches the meaning, or use partial points if it's partially correct.
        </div>
      </div>
    </div>
  );
}

export default memo(TestAnswer);