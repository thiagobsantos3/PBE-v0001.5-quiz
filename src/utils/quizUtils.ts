import { Question } from '../types';
import { Zap, Edit, Calendar, Trophy, ClipboardCheck } from 'lucide-react';
import { StudyItem } from '../types';

/**
 * Filters questions based on user's subscription tier access
 * @param questionList - Array of questions to filter
 * @param userTier - User's subscription tier ('free', 'pro', 'enterprise')
 * @param developerLog - Optional logging function for developer mode
 * @returns Filtered array of questions the user can access
 */
export function getAccessibleQuestions(
  questionList: Question[], 
  userTier: 'free' | 'pro' | 'enterprise' = 'free',
  developerLog?: (...args: any[]) => void
): Question[] {
  const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
  const userTierLevel = tierHierarchy[userTier];
  
  developerLog?.('🔍 getAccessibleQuestions: Input parameters:', {
    totalQuestions: questionList.length,
    userTier,
    userTierLevel
  });
  
  if (questionList.length === 0) {
    developerLog?.('🔍 getAccessibleQuestions: No questions provided, returning empty array');
    return [];
  }
  
  // Log tier distribution of input questions
  const tierDistribution = questionList.reduce((acc, q) => {
    acc[q.tier] = (acc[q.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  developerLog?.('🔍 getAccessibleQuestions: Input questions by tier:', tierDistribution);
  
  return questionList.filter(q => {
    const questionTierLevel = tierHierarchy[q.tier];
    const isAccessible = questionTierLevel <= userTierLevel;
    
    if (!isAccessible) {
      developerLog?.(`🔍 getAccessibleQuestions: Filtering out question with tier '${q.tier}' (level ${questionTierLevel}) for user tier '${userTier}' (level ${userTierLevel})`);
    }
    
    return isAccessible;
  });
}

/**
 * Filter questions based on study items (books, chapters, and optionally verses)
 * @param questions - Array of all available questions
 * @param studyItems - Array of study items with books, chapters, and optional verses
 * @param developerLog - Optional logging function for developer mode
 * @returns Filtered array of questions matching the study items
 */
export function filterQuestionsByStudyItems(
  questions: Question[],
  studyItems: StudyItem[],
  developerLog?: (...args: any[]) => void
): Question[] {
  if (!questions || questions.length === 0) {
    developerLog?.('🔍 filterQuestionsByStudyItems: No questions provided, returning empty array');
    return [];
  }

  if (!studyItems || studyItems.length === 0) {
    developerLog?.('🔍 filterQuestionsByStudyItems: No study items provided, returning empty array');
    return [];
  }

  developerLog?.('🔍 filterQuestionsByStudyItems: Filtering', questions.length, 'questions with', studyItems.length, 'study items');

  let filteredQuestions: Question[] = [];

  studyItems.forEach((item, itemIndex) => {
    developerLog?.(`🔍 filterQuestionsByStudyItems: Processing study item ${itemIndex + 1}:`, {
      book: item.book,
      chapters: item.chapters,
      verses: item.verses,
      hasVerses: !!item.verses && item.verses.length > 0
    });

    item.chapters.forEach(chapter => {
      // Filter questions for this book and chapter
      const bookChapterQuestions = questions.filter(q => 
        q.book_of_bible === item.book && q.chapter === chapter
      );

      developerLog?.(`🔍 filterQuestionsByStudyItems: Found ${bookChapterQuestions.length} questions for ${item.book} Chapter ${chapter}`);

      if (item.verses && item.verses.length > 0) {
        // Filter by specific verses if provided
        const verseFilteredQuestions = bookChapterQuestions.filter(q => {
          const questionVerse = q.verse || 1; // Default to verse 1 if not specified
          return item.verses!.includes(questionVerse);
        });

        developerLog?.(`🔍 filterQuestionsByStudyItems: After verse filtering (verses ${item.verses.join(', ')}): ${verseFilteredQuestions.length} questions`);
        filteredQuestions = [...filteredQuestions, ...verseFilteredQuestions];
      } else {
        // Include all questions from this chapter if no specific verses
        developerLog?.(`🔍 filterQuestionsByStudyItems: Including all questions from ${item.book} Chapter ${chapter}`);
        filteredQuestions = [...filteredQuestions, ...bookChapterQuestions];
      }
    });
  });

  // Remove duplicates (in case the same question appears in multiple study items)
  const uniqueQuestions = filteredQuestions.filter((question, index, self) => 
    index === self.findIndex(q => q.id === question.id)
  );

  developerLog?.('🔍 filterQuestionsByStudyItems: Final result:', {
    totalFiltered: filteredQuestions.length,
    uniqueQuestions: uniqueQuestions.length,
    duplicatesRemoved: filteredQuestions.length - uniqueQuestions.length
  });

  return uniqueQuestions;
}

/**
 * Get chapters available for a specific book from questions
 * @param book - Bible book name
 * @param questions - Array of questions to search
 * @returns Sorted array of chapter numbers
 */
export function getChaptersForBook(book: string, questions: Question[]): number[] {
  const bookQuestions = questions.filter(q => q.book_of_bible === book);
  const chapters = [...new Set(bookQuestions.map(q => q.chapter))].sort((a, b) => a - b);
  return chapters;
}

/**
 * Get verses available for a specific book and chapter from questions
 * @param book - Bible book name
 * @param chapter - Chapter number
 * @param questions - Array of questions to search
 * @returns Sorted array of verse numbers
 */
export function getVersesForChapter(book: string, chapter: number, questions: Question[]): number[] {
  const chapterQuestions = questions.filter(q => 
    q.book_of_bible === book && q.chapter === chapter
  );
  const verses = [...new Set(chapterQuestions.map(q => q.verse || 1))].sort((a, b) => a - b);
  return verses;
}

/**
 * Get available Bible books from questions
 * @param questions - Array of questions to analyze
 * @returns Sorted array of unique book names
 */
export function getAvailableBooksFromQuestions(questions: Question[]): string[] {
  const books = [...new Set(questions.map(q => q.book_of_bible))].sort();
  return books;
}

/**
 * Get display name for quiz type
 * @param type - The quiz type string
 * @returns A human-readable string for the quiz type
 */
export function getQuizTypeDisplayName(type: string): string {
  switch (type) {
    case 'quick-start':
      return 'Quick Start';
    case 'custom':
      return 'Custom Quiz';
    case 'study-assignment':
      return 'Study Assignment';
    default:
      return 'Quiz';
  }
}

/**
 * Get icon component for quiz type
 */
export function getQuizTypeIcon(type: string) {
  switch (type) {
    case 'quick-start':
      return Zap;
    case 'custom':
      return Edit;
    case 'study-assignment':
      return Calendar;
    default:
      return Trophy;
  }
}

/**
 * Select and distribute questions evenly across books and chapters with sophisticated logic
 * This function implements the same logic as CreateOwnQuiz for consistent question selection
 * @param allQuestions - Array of all available questions
 * @param selectedBooks - Array of selected book names
 * @param bookChapterSelections - Object mapping book names to selected chapter arrays
 * @param maxQuestions - Maximum number of questions to select
 * @param userPlan - User's subscription plan for tier filtering
 * @param developerLog - Optional logging function
 * @returns Array of selected questions with even distribution and final shuffle
 */
export function selectAndDistributeQuestions(
  allQuestions: Question[],
  selectedBooks: string[],
  bookChapterSelections: { [book: string]: number[] },
  maxQuestions: number,
  userPlan: 'free' | 'pro' | 'enterprise' = 'free',
  developerLog?: (...args: any[]) => void
): Question[] {
  if (selectedBooks.length === 0) {
    developerLog?.('🔍 selectAndDistributeQuestions: No books selected, returning empty array');
    return [];
  }

  // Step 1: Collect all eligible questions from selected books and chapters
  let allEligibleQuestions: Question[] = [];
  
  selectedBooks.forEach(book => {
    const bookChapters = bookChapterSelections[book] || [];
    if (bookChapters.length > 0) {
      const bookQuestions = allQuestions.filter(q => 
        q.book_of_bible === book && bookChapters.includes(q.chapter)
      );
      allEligibleQuestions = [...allEligibleQuestions, ...bookQuestions];
    }
  });

  // Filter by user's tier access
  allEligibleQuestions = getAccessibleQuestions(allEligibleQuestions, userPlan);

  if (allEligibleQuestions.length === 0) {
    developerLog?.('🔍 selectAndDistributeQuestions: No eligible questions found');
    return [];
  }

  developerLog?.('🔍 selectAndDistributeQuestions: Found', allEligibleQuestions.length, 'eligible questions');

  // Step 2: Group questions by book:chapter for even distribution
  const questionsByChapter = new Map<string, Question[]>();
  
  allEligibleQuestions.forEach(q => {
    const chapterKey = `${q.book_of_bible}:${q.chapter}`;
    if (!questionsByChapter.has(chapterKey)) {
      questionsByChapter.set(chapterKey, []);
    }
    questionsByChapter.get(chapterKey)!.push(q);
  });

  // Step 3: Calculate target questions per chapter for even distribution
  const totalChapters = questionsByChapter.size;
  const targetPerChapter = Math.floor(maxQuestions / totalChapters);
  const remainder = maxQuestions % totalChapters;

  const selectedQuestions: Question[] = [];
  const usedVerseKeys = new Set<string>(); // Track book:chapter:verse to avoid repetition
  const chapterKeys = Array.from(questionsByChapter.keys());

  developerLog?.('🔍 selectAndDistributeQuestions: Distribution plan:', {
    totalChapters,
    targetPerChapter,
    remainder,
    maxQuestions
  });

  // Step 4: First pass - distribute questions evenly across chapters, avoiding verse repetition
  for (let round = 0; round < targetPerChapter; round++) {
    for (const chapterKey of chapterKeys) {
      if (selectedQuestions.length >= maxQuestions) break;
      
      const chapterQuestions = questionsByChapter.get(chapterKey)!;
      
      // Find a question from this chapter that hasn't been used (by verse)
      const availableQuestion = chapterQuestions.find(q => {
        const verseKey = `${q.book_of_bible}:${q.chapter}:${q.verse || 1}`;
        return !usedVerseKeys.has(verseKey);
      });
      
      if (availableQuestion) {
        selectedQuestions.push(availableQuestion);
        const verseKey = `${availableQuestion.book_of_bible}:${availableQuestion.chapter}:${availableQuestion.verse || 1}`;
        usedVerseKeys.add(verseKey);
      }
    }
  }

  // Step 5: Distribute remainder questions to chapters with most available questions
  if (remainder > 0 && selectedQuestions.length < maxQuestions) {
    // Sort chapters by number of unused questions (descending)
    const chaptersByAvailability = chapterKeys
      .map(chapterKey => {
        const chapterQuestions = questionsByChapter.get(chapterKey)!;
        const unusedQuestions = chapterQuestions.filter(q => {
          const verseKey = `${q.book_of_bible}:${q.chapter}:${q.verse || 1}`;
          return !usedVerseKeys.has(verseKey);
        });
        return { chapterKey, unusedCount: unusedQuestions.length, questions: unusedQuestions };
      })
      .sort((a, b) => b.unusedCount - a.unusedCount);

    for (let i = 0; i < remainder && selectedQuestions.length < maxQuestions; i++) {
      const chapterData = chaptersByAvailability[i % chaptersByAvailability.length];
      if (chapterData && chapterData.unusedCount > 0) {
        const availableQuestion = chapterData.questions.find(q => {
          const verseKey = `${q.book_of_bible}:${q.chapter}:${q.verse || 1}`;
          return !usedVerseKeys.has(verseKey);
        });
        
        if (availableQuestion) {
          selectedQuestions.push(availableQuestion);
          const verseKey = `${availableQuestion.book_of_bible}:${availableQuestion.chapter}:${availableQuestion.verse || 1}`;
          usedVerseKeys.add(verseKey);
          chapterData.unusedCount--;
        }
      }
    }
  }

  // Step 6: If we still need more questions, allow verse repetition
  if (selectedQuestions.length < maxQuestions) {
    const remainingQuestions = allEligibleQuestions.filter(q => 
      !selectedQuestions.some(selected => selected.id === q.id)
    );
    
    // Shuffle remaining questions and add them
    const shuffledRemaining = [...remainingQuestions].sort(() => 0.5 - Math.random());
    const needed = maxQuestions - selectedQuestions.length;
    selectedQuestions.push(...shuffledRemaining.slice(0, needed));
  }

  // Step 7: Final shuffle to ensure random order
  const finalQuestions = [...selectedQuestions].sort(() => 0.5 - Math.random());

  developerLog?.('🔍 selectAndDistributeQuestions: Final result:', {
    selectedCount: finalQuestions.length,
    requestedMax: maxQuestions,
    uniqueVerses: usedVerseKeys.size,
    chaptersUsed: questionsByChapter.size
  });

  return finalQuestions;
}

/**
 * Convert StudyItems to the format expected by selectAndDistributeQuestions
 * @param studyItems - Array of StudyItem objects
 * @returns Object with selectedBooks array and bookChapterSelections object
 */
export function convertStudyItemsToBookChapterFormat(studyItems: StudyItem[]): {
  selectedBooks: string[];
  bookChapterSelections: { [book: string]: number[] };
} {
  const selectedBooks: string[] = [];
  const bookChapterSelections: { [book: string]: number[] } = {};

  studyItems.forEach(item => {
    if (!selectedBooks.includes(item.book)) {
      selectedBooks.push(item.book);
    }
    
    if (!bookChapterSelections[item.book]) {
      bookChapterSelections[item.book] = [];
    }
    
    // Add chapters that aren't already included
    item.chapters.forEach(chapter => {
      if (!bookChapterSelections[item.book].includes(chapter)) {
        bookChapterSelections[item.book].push(chapter);
      }
    });
  });

  return { selectedBooks, bookChapterSelections };
}