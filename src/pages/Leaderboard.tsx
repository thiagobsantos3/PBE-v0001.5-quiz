import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeamLeaderboardData } from '../hooks/useTeamLeaderboardData';
import { LeaderboardTable } from '../components/analytics/LeaderboardTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AlertMessage } from '../components/common/AlertMessage';
import { getSundayOfWeek, addDays } from '../utils/dateUtils';
import { 
  Trophy, 
  Users, 
  TrendingUp
} from 'lucide-react';

// Helper function to calculate date range for a given timeframe
function calculateDateRangeForTimeframe(timeframe: 'weekly' | 'monthly' | 'all-time', referenceDate: Date = new Date()): { startDate: Date | undefined; endDate: Date | undefined } {
  switch (timeframe) {
    case 'weekly': {
      const startDate = getSundayOfWeek(referenceDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = addDays(startDate, 6); // Saturday
      endDate.setHours(23, 59, 59, 999);
      
      return { startDate, endDate };
    }
    case 'monthly': {
      const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      return { startDate, endDate };
    }
    case 'all-time':
    default:
      return { startDate: undefined, endDate: undefined };
  }
}

// Helper function to get CSS classes for timeframe buttons
function getTimeframeButtonClasses(buttonTimeframe: string, selectedTimeframe: string): string {
  const baseClasses = 'px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200';
  const activeClasses = 'bg-gray-700 text-white shadow-sm';
  const inactiveClasses = 'text-gray-700 hover:bg-gray-200';
  
  return `${baseClasses} ${selectedTimeframe === buttonTimeframe ? activeClasses : inactiveClasses}`;
}

export function Leaderboard() {
  const { user } = useAuth();
  
  // Time filter state
  const [selectedTimeframe, setSelectedTimeframe] = useState<'weekly' | 'monthly' | 'all-time'>('weekly');
  
  // Initialize dates with weekly values using useMemo
  const initialWeeklyDates = useMemo(() => calculateDateRangeForTimeframe('weekly'), []);
  
  const [startDate, setStartDate] = useState<Date | undefined>(initialWeeklyDates.startDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialWeeklyDates.endDate);

  // Calculate and update date range when timeframe changes
  React.useEffect(() => {
    const { startDate: newStartDate, endDate: newEndDate } = calculateDateRangeForTimeframe(selectedTimeframe);

    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }, [selectedTimeframe]);

  // Fetch team leaderboard data
  const { data: leaderboardData, loading, error, refreshData } = useTeamLeaderboardData({
    teamId: user?.teamId,
    startDate,
    endDate,
  });


  // Check if user has a team
  if (!user?.teamId) {
    return (
      <div className="p-6">
        <div className="p-6">
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Team Found</h2>
            <p className="text-gray-600">You need to be part of a team to view the leaderboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="p-6">
        {/* Time Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-center">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setSelectedTimeframe('weekly')}
                className={getTimeframeButtonClasses('weekly', selectedTimeframe)}
              >
                Weekly
              </button>
              <button
                onClick={() => setSelectedTimeframe('monthly')}
                className={getTimeframeButtonClasses('monthly', selectedTimeframe)}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedTimeframe('all-time')}
                className={getTimeframeButtonClasses('all-time', selectedTimeframe)}
              >
                <span className="hidden sm:inline">All Time</span>
                <span className="sm:hidden">All</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <AlertMessage
            type="error"
            message={error}
            className="mb-6"
          />
        )}

        {/* Loading State */}
        {loading && (
          <LoadingSpinner text="Loading team leaderboard..." className="py-8" />
        )}

        {/* Leaderboard Table */}
        {!loading && (
          <LeaderboardTable 
            data={leaderboardData} 
            loading={loading} 
            error={error} 
            selectedTimeframe={selectedTimeframe}
          />
        )}
      </div>
  );
}