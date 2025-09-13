import React from 'react';
import { useAnalyticsContext } from '../../contexts/AnalyticsContext';
import { useQuizHistoryDataWithLocalUpdate } from '../../hooks/useQuizHistoryData';
import { QuizHistoryTable } from './QuizHistoryTable';

export function QuizHistoryTab() {
  const {
    selectedMemberId,
    startDate,
    endDate
  } = useAnalyticsContext();

  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const { 
    data: quizHistoryData, 
    totalCount,
    loading: quizHistoryLoading, 
    error: quizHistoryError,
    refreshData: refreshQuizHistoryData,
    updateLocalQuizHistoryEntry 
  } = useQuizHistoryDataWithLocalUpdate({
    userId: selectedMemberId,
    startDate,
    endDate,
    page: currentPage,
    pageSize
  });

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedMemberId, startDate, endDate]);

  return (
    <QuizHistoryTable
      data={quizHistoryData}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      loading={quizHistoryLoading}
      error={quizHistoryError}
      updateLocalQuizHistoryEntry={updateLocalQuizHistoryEntry}
      refreshData={refreshQuizHistoryData}
    />
  );
}