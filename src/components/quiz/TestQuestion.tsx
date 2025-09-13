import React, { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Question } from '../../types';

interface TestQuestionProps {
  question: Question;
  hasTimeExpired: boolean;
  isFullScreen: boolean;
  isDarkMode: boolean;
  themeClasses: any;
  typedAnswer: string;
  onTypedAnswerChange: (answer: string) => void;
}

export function TestQuestion({ 
  question, 
  hasTimeExpired, 
  isFullScreen,
  isDarkMode, 
  themeClasses,
  typedAnswer,
  onTypedAnswerChange
}: TestQuestionProps) {
  return (
    <div className="text-center">
      <div className="mb-6 sm:mb-8">
        <div className={`font-medium mb-2 sm:mb-4 ${isFullScreen ? (isDarkMode ? 'text-blue-300' : 'text-[#1a255b]') : 'text-indigo-600'} ${isFullScreen ? 'text-[2.5vw]' : 'text-lg'}`}>
          {question.points} points
        </div>
        <h2 className={`font-semibold ${themeClasses.text} leading-relaxed ${isFullScreen ? 'text-[3.5vw]' : 'text-lg sm:text-2xl'} mb-6`}>
          {question.question}
        </h2>
        
        {/* Typed Answer Input for Mock Tests */}
        <div className="mt-6">
          <label className={`block text-sm font-medium ${themeClasses.text} mb-2 text-left`}>
            Your Answer:
          </label>
          <textarea
            value={typedAnswer}
            onChange={(e) => onTypedAnswerChange(e.target.value)}
            placeholder="Type your answer here..."
            rows={4}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200 ${
              isFullScreen 
                ? 'bg-white/10 border-white/20 text-white placeholder-white/60 backdrop-blur-sm'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${isFullScreen ? 'text-lg' : 'text-base'}`}
            disabled={hasTimeExpired}
            autoFocus
          />
          <div className={`text-xs ${themeClasses.textSecondary} mt-2 text-left`}>
            Type your complete answer and click "Submit Answer" to continue to the next question.
          </div>
        </div>
      </div>
      
      {hasTimeExpired && (
        <div className={`mb-6 p-4 border-2 ${isFullScreen ? 'border-red-300 bg-red-500/20' : 'border-red-200 bg-red-50'} rounded-lg`}>
          <div className={`flex items-center justify-center space-x-2 ${isFullScreen ? 'text-red-300' : 'text-red-700'}`}>
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold text-lg">Time's Up!</span>
          </div>
          <p className={`${isFullScreen ? 'text-red-200' : 'text-red-600'} text-sm mt-1`}>
            Click "Show Answer" to reveal the answer and mark your response
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(TestQuestion);