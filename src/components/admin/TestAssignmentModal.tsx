import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { FormField } from '../common/FormField';
import { Button } from '../common/Button';
import { AlertMessage } from '../common/AlertMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useQuestion } from '../../contexts/QuestionContext';
import { useStudyItemForm } from '../../hooks/useStudyItemForm';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { TestAssignment, StudyItem } from '../../types';
import { getAccessibleQuestions, filterQuestionsByStudyItems, getAvailableBooksFromQuestions, getChaptersForBook, convertStudyItemsToBookChapterFormat, selectAndDistributeQuestions } from '../../utils/quizUtils';
import { formatNumberRanges } from '../../utils/quizHelpers';
import { Save, Plus, Trash2, BookOpen, Users, Check, Target, Clock, AlertCircle } from 'lucide-react';

interface TestAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assignment: Omit<TestAssignment, 'id' | 'created_at' | 'updated_at'>, memberIds: string[]) => Promise<void>;
  onUpdate: (assignmentId: string, updates: Partial<TestAssignment>, memberIds: string[]) => Promise<void>;
  editingAssignment: TestAssignment | null;
  loading: boolean;
  error: string | null;
}

export function TestAssignmentModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  editingAssignment,
  loading,
  error
}: TestAssignmentModalProps) {
  const { user } = useAuth();
  const { questions } = useQuestion();
  const { teamMembers } = useTeamManagement();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxQuestions, setMaxQuestions] = useState(20);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Study items form
  const {
    studyItems,
    currentBook,
    currentChapters,
    currentVerses,
    startVerseInput,
    endVerseInput,
    setCurrentBook,
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
    initializeForm,
    getVersesForBookChapter
  } = useStudyItemForm(questions);

  // Initialize form when editing assignment changes
  useEffect(() => {
    if (editingAssignment) {
      setTitle(editingAssignment.title);
      setDescription(editingAssignment.description || '');
      setMaxQuestions(editingAssignment.max_questions);
      initializeForm(editingAssignment.study_items, editingAssignment.description || '');
      // TODO: Load assigned members for editing assignment
      setSelectedMembers([]);
    } else {
      setTitle('');
      setDescription('');
      setMaxQuestions(20);
      setSelectedMembers([]);
      resetForm();
    }
    setFormError(null);
  }, [editingAssignment, initializeForm, resetForm]);

  // Get available books from questions
  const availableBooks = React.useMemo(() => 
    getAvailableBooksFromQuestions(questions), 
    [questions]
  );

  // Check if verse selection should be enabled (only when exactly one chapter is selected)
  const canSelectVerses = currentBook && currentChapters.length === 1;
  const availableVerses = canSelectVerses 
    ? getVersesForBookChapter(currentBook, currentChapters[0])
    : [];

  // Calculate total available questions for selected study items
  const calculateAvailableQuestions = React.useCallback((): number => {
    if (studyItems.length === 0) return 0;
    
    let count = 0;
    studyItems.forEach(item => {
      let itemQuestions = questions.filter(q => 
        q.book_of_bible === item.book && item.chapters.includes(q.chapter)
      );
      
      if (item.verses && item.verses.length > 0) {
        itemQuestions = itemQuestions.filter(q => {
          const questionVerse = q.verse || 1;
          return item.verses!.includes(questionVerse);
        });
      }
      
      count += itemQuestions.length;
    });
    
    return count;
  }, [studyItems, questions]);

  const availableQuestionsCount = calculateAvailableQuestions();

  // Handle member selection
  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAllMembers = () => {
    const memberIds = teamMembers.filter(m => m.role === 'member').map(m => m.userId);
    setSelectedMembers(memberIds);
  };

  const handleClearMembers = () => {
    setSelectedMembers([]);
  };

  const handleSave = async () => {
    setFormError(null);

    // Validation
    if (!title.trim()) {
      setFormError('Test title is required');
      return;
    }

    if (studyItems.length === 0) {
      setFormError('At least one study item is required');
      return;
    }

    if (selectedMembers.length === 0) {
      setFormError('At least one team member must be selected');
      return;
    }

    if (maxQuestions <= 0) {
      setFormError('Maximum questions must be greater than 0');
      return;
    }

    if (maxQuestions > availableQuestionsCount) {
      setFormError(`Maximum questions cannot exceed ${availableQuestionsCount} (available questions)`);
      return;
    }


    try {
      // Convert study items to the format expected by the selection utility
      const { selectedBooks, bookChapterSelections } = convertStudyItemsToBookChapterFormat(studyItems);
      
      // Use the centralized question selection utility for even distribution
      const testQuestions = selectAndDistributeQuestions(
        questions,
        selectedBooks,
        bookChapterSelections,
        maxQuestions,
        user?.subscription?.plan || 'free',
        console.log
      );
      
      if (testQuestions.length === 0) {
        setFormError('No questions available for the selected study items and subscription tier.');
        return;
      }

      console.log('🎯 TestAssignmentModal: Selected questions using centralized utility:', testQuestions.length);

      const assignmentData = {
        title,
        description,
        assigned_by: user!.id,
        study_items: studyItems,
        max_questions: maxQuestions,
        is_active: true,
        test_questions: testQuestions, // Store the generated questions
      };

      if (editingAssignment) {
        await onUpdate(editingAssignment.id, assignmentData, selectedMembers);
      } else {
        await onSave(assignmentData, selectedMembers);
      }

      setDescription('');
      setMaxQuestions(20);
      setSelectedMembers([]);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error saving test assignment:', error);
      setFormError('Failed to save test assignment. Please try again.');
    }
  };

  const formatStudyItemsWithVerses = React.useCallback((items: StudyItem[]): string => {
    if (!items || items.length === 0) return '';
    
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

  // Filter team members to only show members (not owners/admins)
  const availableMembers = teamMembers.filter(member => member.role === 'member');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAssignment ? 'Edit Test' : 'Create New Test'}
      maxWidth="4xl"
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={loading}>
            {editingAssignment ? 'Update Test' : 'Create Test'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {(error || formError) && (
          <AlertMessage
            type="error"
            message={error || formError || ''}
            className="mb-4"
          />
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Test Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Test Title"
              id="testTitle"
              type="text"
              value={title}
              onChange={setTitle}
              placeholder="e.g., Isaiah Chapters 1-5 Assessment"
              required
            />
            
            <FormField
              label="Maximum Questions"
              id="maxQuestions"
              type="number"
              value={maxQuestions}
              onChange={(val) => setMaxQuestions(parseInt(val) || 20)}
              min={1}
              max={availableQuestionsCount || 100}
              required
              helpText={`Up to ${availableQuestionsCount} questions available`}
            />
          </div>
          
          <FormField
            label="Description (Optional)"
            id="testDescription"
            type="textarea"
            value={description}
            onChange={setDescription}
            placeholder="Describe the purpose and scope of this test..."
            rows={3}
          />
        </div>

        {/* Team Member Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-600" />
              <span>Assign to Team Members</span>
            </h3>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleSelectAllMembers}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearMembers}
                className="text-sm text-gray-600 hover:text-gray-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>
          
          {availableMembers.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No team members available</p>
              <p className="text-sm text-gray-400">Team members with 'member' role will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {availableMembers.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => handleMemberToggle(member.userId)}
                  className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedMembers.includes(member.userId)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-indigo-600">
                      {member.user.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{member.user.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                  </div>
                  {selectedMembers.includes(member.userId) && (
                    <Check className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
          
          {selectedMembers.length > 0 && (
            <div className="text-sm text-gray-600">
              {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Study Items Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add Study Item Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Test Content</h3>
            
            <FormField
              label="Bible Book"
              id="bibleBook"
              type="select"
              value={currentBook}
              onChange={setCurrentBook}
              options={[
                ...availableBooks.map(book => ({ value: book, label: book }))
              ]}
              placeholder="Select a book"
            />
            
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
            
            <Button
              variant="primary"
              icon={Plus}
              onClick={addStudyItem}
              disabled={!currentBook || currentChapters.length === 0}
              fullWidth
            >
              Add to Test
            </Button>
          </div>
          
          {/* Current Test Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Test Coverage</h3>
            
            {studyItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No study items added yet</p>
                <p className="text-sm">Select books and chapters to add content</p>
              </div>
            ) : (
              <>
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

                {/* Test Statistics */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3">Test Statistics</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-900">{availableQuestionsCount}</div>
                      <div className="text-sm text-blue-700">Available Questions</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-900">{Math.min(maxQuestions, availableQuestionsCount)}</div>
                      <div className="text-sm text-blue-700">Test Questions</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-900">
                        ~{Math.round((Math.min(maxQuestions, availableQuestionsCount) * 30) / 60)}
                      </div>
                      <div className="text-sm text-blue-700">Est. Minutes</div>
                    </div>
                  </div>
                </div>

                {/* Coverage Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Coverage Summary</h4>
                  <p className="text-sm text-gray-700">
                    {formatStudyItemsWithVerses(studyItems)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Validation Warnings */}
        {studyItems.length > 0 && maxQuestions > availableQuestionsCount && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Question Limit Warning</p>
                <p>
                  You've set the maximum questions to {maxQuestions}, but only {availableQuestionsCount} questions 
                  are available for the selected content. The test will include all {availableQuestionsCount} available questions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}