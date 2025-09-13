import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuestion } from '../contexts/QuestionContext';
import { useQuizSession } from '../contexts/QuizSessionContext';
import { useStudyItemForm } from '../hooks/useStudyItemForm';
import { Layout } from '../components/layout/Layout';
import { 
  ArrowLeft,
  Edit,
  Play,
  BookOpen,
  Target,
  Clock,
  Shuffle,
  AlertCircle,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { Question, StudyItem } from '../types';
import { getAccessibleQuestions, filterQuestionsByStudyItems, getAvailableBooksFromQuestions, getChaptersForBook, convertStudyItemsToBookChapterFormat, selectAndDistributeQuestions } from '../utils/quizUtils';
import { formatNumberRanges } from '../utils/quizHelpers';

export function MockTestCreation() {
  const navigate = useNavigate();
  const { user, developerLog } = useAuth();
  const { questions, loading: questionsLoading, fetchQuestions } = useQuestion();
  const { createQuizSession, getActiveSessionsForUser } = useQuizSession();
  
  // Redirect if user does not have access to mock test creation
  useEffect(() => {
    if (!user) return; // Wait for user to load
    if (user.planSettings && !user.planSettings.allow_mock_test_creation) {
      navigate('/quiz', { replace: true });
    }
  }, [user, navigate]);

  const {
    studyItems,
    currentBook,
    currentChapters,
    currentVerses,
    startVerseInput,
    endVerseInput,
    description,
    setCurrentBook,
    setDescription,
    toggleChapter,
    selectAllChapters,
    clearChapters,
    toggleVerse,
    selectAllVerses,
    clearVerses,
    selectVerseRange,
    updateStartVerseInput,
    updateEndVerseInput,
    addStudyItem,
    removeStudyItem,
    resetForm,
    getMaxChapters,
    getVersesForBookChapter
  } = useStudyItemForm(questions);

  const [maxQuestions, setMaxQuestions] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load questions when component mounts
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Get accessible questions based on user subscription (must be before effects that depend on them)
  const allAccessibleQuestions = React.useMemo(() => {
    return getAccessibleQuestions(questions, user?.subscription?.plan || 'free');
  }, [questions, user?.subscription?.plan]);

  const availableBooks = React.useMemo(
    () => getAvailableBooksFromQuestions(allAccessibleQuestions),
    [allAccessibleQuestions]
  );

  // Set default book when questions are loaded and no book is selected
  useEffect(() => {
    if (!questionsLoading && availableBooks.length > 0 && !currentBook) {
      setCurrentBook(availableBooks[0]);
    }
  }, [questionsLoading, availableBooks, currentBook, setCurrentBook]);

  // Get count of available questions for the selected study items
  const availableQuestionsCount = React.useMemo(() => {
    const filtered = filterQuestionsByStudyItems(allAccessibleQuestions, studyItems);
    return filtered.length;
  }, [studyItems, allAccessibleQuestions]);

  // Manage loading state based on questions loading
  useEffect(() => {
    if (questionsLoading) {
      setLoading(true);
      return;
    }
    // Once questions are loaded, set loading to false
    // No need to check for existing sessions here, always show the form
    if (!user) { // Ensure user is loaded before setting loading to false
      setLoading(false);
      setError('User not authenticated'); // Or handle user not logged in
    }
    setLoading(false);
  }, [questionsLoading, user]);

  // Check if verse selection should be enabled (only when exactly one chapter is selected)
  const canSelectVerses = currentBook && currentChapters.length === 1;
  const availableVerses = canSelectVerses 
    ? getVersesForBookChapter(currentBook, currentChapters[0])
    : [];

  const handleStartMockTest = async () => {
    if (studyItems.length === 0 || !user) {
      setError('Please select study items to create questions for your mock test.');
      return;
    }

    setLoading(true);
    setError(null);
    
    // Convert study items to the format expected by the selection utility
    const { selectedBooks, bookChapterSelections } = convertStudyItemsToBookChapterFormat(studyItems);
    
    // Use the centralized question selection utility for even distribution
    const finalTestQuestions = selectAndDistributeQuestions(
      allAccessibleQuestions,
      selectedBooks,
      bookChapterSelections,
      maxQuestions,
      user?.subscription?.plan || 'free',
      developerLog
    );
    
    if (finalTestQuestions.length === 0) {
      setError('No questions available for the selected study items and your subscription tier.');
      setLoading(false);
      return;
    }

    developerLog?.('🎯 MockTestCreation: Selected questions using centralized utility:', finalTestQuestions.length);

    try {
      // Calculate quiz metadata
      const totalPoints = finalTestQuestions.reduce((sum, q) => sum + q.points, 0);
      const estimatedSeconds = finalTestQuestions.reduce((sum, q) => sum + q.time_to_answer, 0);
      const estimatedMinutes = Math.round(estimatedSeconds / 60);

      // Generate quiz title and description
      const title = studyItems.length === 1 
        ? `${studyItems[0].book} Mock Test`
        : `Multi-Book Mock Test`;
      
      const testDescription = description.trim() || 
        `Mock test covering ${studyItems.map(item => {
          if (item.verses && item.verses.length > 0) {
            const verseRanges = formatNumberRanges(item.verses);
            return `${item.book} Ch.${item.chapters.join(',')} (Verses: ${verseRanges})`;
          } else {
            return `${item.book} Ch.${item.chapters.join(',')}`;
          }
        }).join(', ')}`;

      // Create quiz session for mock test
      const sessionId = await createQuizSession({
        type: 'mock-test',
        title,
        description: testDescription,
        user_id: user.id,
        team_id: user.teamId,
        questions: finalTestQuestions,
        current_question_index: 0,
        results: [],
        status: 'active',
        show_answer: false,
        time_left: finalTestQuestions[0]?.time_to_answer || 30,
        timer_active: false,
        timer_started: false,
        has_time_expired: false,
        challenge_status: 'none',
      });

      // Navigate to the test runner
      navigate(`/quiz/test-runner/${sessionId}`);
    } catch (error) {
      console.error('Error creating mock test:', error);
      setError('Failed to create mock test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatStudyItemsWithVerses = React.useCallback((items: StudyItem[]): string => {
    if (!items || items.length === 0) return ''; // Defensive check

    return items.map(item => {
      if (item.verses && item.verses.length > 0) {
        const verseRanges = formatNumberRanges(item.verses);
        if (item.chapters.length === 1) {
          return `${item.book} ${item.chapters[0]}:${verseRanges}`;
        } else {
          return `${item.book} (Ch. ${item.chapters.join(', ')}, Verses: ${verseRanges})`;
        }
      } else {
        if (item.chapters.length === 1) {
          return `${item.book} Chapter ${item.chapters[0]}`;
        } else {
          return `${item.book} (Ch. ${item.chapters.join(', ')})`;
        }
      }
    }).join(', ');
  }, []);

  // Calculate estimated time
  const filteredQuestions = React.useMemo(() => {
    const filtered = filterQuestionsByStudyItems(allAccessibleQuestions, studyItems);
    return filtered.slice(0, maxQuestions);
  }, [studyItems, allAccessibleQuestions, maxQuestions]);

  const estimatedMinutes = Math.round(filteredQuestions.reduce((sum, q) => sum + q.time_to_answer, 0) / 60);
  const maxPoints = filteredQuestions.reduce((sum, q) => sum + q.points, 0);

  if (questionsLoading) {
    return (
      <Layout>
        <div className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/quiz')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Quiz Center</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 text-center">
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading Questions...</h1>
            <p className="text-gray-600">Please wait while we fetch the available questions.</p>
          </div>
        </div>
      </div>
      </Layout>
    );
  }
  
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mock test creation...</p>
        </div>
      </div>
      </Layout>
    );
  }

  // If there's an error and we're not loading, display it
  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/quiz')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            Back to Quiz Center
          </button>
        </div>
      </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
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

        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Edit className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Mock Test</h1>
              <p className="text-gray-600">
                Create a practice test with typed answers. Select your study content and test your knowledge.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Configuration Panel */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Test Configuration</h3>
                
              {/* Book Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Bible Book
                </label>
                <select
                  value={currentBook}
                  onChange={(e) => setCurrentBook(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
                > 
                  {availableBooks.map((book) => (
                    <option key={book} value={book}>{book}</option>
                  ))}
                </select>
                {availableBooks.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No books available. Questions need to be added to the system.
                  </p>
                )}
              </div>
                
              {/* Chapter Selection */}
              {currentBook && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Chapters
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllChapters}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearChapters}
                        className="text-xs text-gray-600 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                    
                  <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {getChaptersForBook(currentBook, questions).map((chapter) => (
                      <button
                        key={chapter}
                        type="button"
                        onClick={() => toggleChapter(chapter)}
                        className={`p-2 text-sm rounded transition-colors duration-200 ${
                          currentChapters.includes(chapter)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {chapter}
                      </button>
                    ))}
                  </div>
                    
                  {currentChapters.length > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      Selected: {currentChapters.join(', ')} ({currentChapters.length} chapter{currentChapters.length !== 1 ? 's' : ''})
                    </div>
                  )}
                </div>
              )}
                
              {/* Verse Selection - Only show when exactly one chapter is selected */}
              {canSelectVerses && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Verses (Optional)
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllVerses}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearVerses}
                        className="text-xs text-gray-600 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                    
                  {availableVerses.length > 0 ? (
                    <>
                      {/* Verse Range Selection */}
                      <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-sm font-medium text-purple-900 mb-2">Quick Range Selection</div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            max={Math.max(...availableVerses)}
                            value={startVerseInput}
                            onChange={(e) => updateStartVerseInput(e.target.value)}
                            placeholder="Start"
                            className="w-20 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          />
                          <span className="text-purple-700 font-medium">to</span>
                          <input
                            type="number"
                            min="1"
                            max={Math.max(...availableVerses)}
                            value={endVerseInput}
                            onChange={(e) => updateEndVerseInput(e.target.value)}
                            placeholder="End"
                            className="w-20 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          />
                          <button
                            type="button"
                            onClick={selectVerseRange}
                            disabled={!startVerseInput || !endVerseInput}
                            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            Select Range
                          </button>
                        </div>
                      </div>
                        
                      <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {availableVerses.map((verse) => (
                          <button
                            key={verse}
                            type="button"
                            onClick={() => toggleVerse(verse)}
                            className={`p-1 text-xs rounded transition-colors duration-200 ${
                              currentVerses.includes(verse)
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {verse}
                          </button>
                        ))}
                      </div>
                        
                      {currentVerses.length > 0 && (
                        <div className="text-sm text-gray-600 mt-2">
                          Selected verses: {formatNumberRanges(currentVerses)} ({currentVerses.length} verse{currentVerses.length !== 1 ? 's' : ''})
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                      No verses available for {currentBook} Chapter {currentChapters[0]}. Questions need to be added for this chapter.
                    </div>
                  )}
                </div>
              )}
                
              <button
                type="button"
                onClick={addStudyItem}
                disabled={!currentBook || currentChapters.length === 0}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <Plus className="h-4 w-4" />
                <span>Add to Test</span>
              </button>

              {/* Maximum Questions */}
              {availableQuestionsCount > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Maximum Questions
                  </label>
                  <div className="space-y-3">
                    <input
                      type="range"
                      min="1"
                      max={Math.min(100, availableQuestionsCount)}
                      value={maxQuestions}
                      onChange={(e) => setMaxQuestions(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {Math.min(maxQuestions, availableQuestionsCount)} question{Math.min(maxQuestions, availableQuestionsCount) !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-500 flex items-center space-x-1">
                        {availableQuestionsCount} available
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Notes (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
                  placeholder="Add notes about this test, focus areas, or special instructions..."
                />
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Test Preview</h3>
                
              {/* Test Stats */}
              {filteredQuestions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{filteredQuestions.length}</div>
                    <div className="text-sm text-gray-600">Questions</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">~{estimatedMinutes}</div>
                    <div className="text-sm text-gray-600">Minutes</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{maxPoints}</div>
                    <div className="text-sm text-gray-600">Max Points</div>
                  </div>
                </div>
              ) : null}

              {/* Study Items List */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Test Content</h4>
                {studyItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No study items added yet</p>
                    <p className="text-sm">Select books and chapters above</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {studyItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{item.book}</div>
                          <div className="text-sm text-gray-600">
                            {item.verses && item.verses.length > 0 ? (
                              <>
                                <div>Chapters: {item.chapters.join(', ')}</div>
                                <div className="text-purple-600 font-medium">
                                  Verses: {formatNumberRanges(item.verses)}
                                </div>
                              </>
                            ) : (
                              <div>Chapters: {item.chapters.join(', ')} (All verses)</div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStudyItem(index)}
                          className="text-red-600 hover:text-red-700 transition-colors duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Important Test Information */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-1">Mock Test Information:</p>
                    <ul className="space-y-1 text-orange-700">
                      <li>• You will type your answers for each question</li>
                      <li>• Results will be automatically graded and marked as "temporary"</li>
                      <li>• You can review and challenge any marking before final results</li>
                      <li>• XP and achievements will be awarded after review is complete</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Start Test Button */}
              <button 
                onClick={handleStartMockTest} 
                disabled={filteredQuestions.length === 0 || loading}
                className="w-full flex items-center justify-center space-x-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Creating Test...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    <span>Start Mock Test</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}

export default MockTestCreation;