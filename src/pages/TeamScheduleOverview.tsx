import React, { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useStudyAssignments } from '../hooks/useStudyAssignments';
import { TeamWeeklyScheduleTable } from '../components/schedule/TeamWeeklyScheduleTable';
import { getSundayOfWeek, addDays, isSameDay } from '../utils/dateUtils';
import { ArrowLeft, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TeamScheduleOverview() {
  const { user, developerLog } = useAuth();
  const navigate = useNavigate();
  const { assignments, teamMembers, loading } = useStudyAssignments();
  
  // Initialize to current week's Sunday
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getSundayOfWeek(new Date()));

  // Calculate the days of the week (Sunday to Saturday)
  const weekDays = React.useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    
    // Debug the calculated week days
    developerLog('📅 TeamScheduleOverview: Calculated week days:', {
      currentWeekStart: currentWeekStart.toISOString(),
      weekDays: days.map((day, index) => ({
        index,
        date: day.toISOString(),
        dayOfWeek: day.getDay(),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()],
        dateString: day.toDateString()
      }))
    });
    
    return days;
  }, [currentWeekStart, developerLog]);

  // Check if user has permission to view team overview
  const canViewTeamOverview = user?.teamRole === 'owner' || user?.teamRole === 'admin';

  const handleNavigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const daysToAdd = direction === 'next' ? 7 : -7;
      return addDays(prev, daysToAdd);
    });
  };

  const handleGoToCurrentWeek = () => {
    setCurrentWeekStart(getSundayOfWeek(new Date()));
  };

  // Redirect if user doesn't have permission
  if (!canViewTeamOverview) {
    return (
      <Layout>
        <div className="p-6">
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You need to be a team owner or admin to view the team schedule overview.
            </p>
            <button
              onClick={() => navigate('/schedule')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              Back to My Schedule
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user?.teamId) {
    return (
      <Layout>
        <div className="p-6">
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="h-8 w-8 text-gray-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">No Team Found</h1>
            <p className="text-gray-600 mb-6">
              You need to be part of a team to view the team schedule overview.
            </p>
            <button
              onClick={() => navigate('/schedule')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              Back to Schedule
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/schedule')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to My Schedule</span>
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Schedule Overview</h1>
                <p className="text-gray-600">
                  View study assignment completion status for all team members
                </p>
              </div>
            </div>
            
            <button
              onClick={handleGoToCurrentWeek}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              Current Week
            </button>
          </div>
        </div>

        {/* Team Weekly Schedule Table */}
        <TeamWeeklyScheduleTable
          teamMembers={teamMembers}
          allAssignments={assignments}
          loading={loading}
          currentWeekStart={currentWeekStart}
          weekDays={weekDays}
          onNavigateWeek={handleNavigateWeek}
        />

        {/* Summary Stats */}
        {!loading && teamMembers.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Week Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                let totalAssignments = 0;
                let completedOnTime = 0;
                let completedEarly = 0;
                let completedLate = 0;
                let pending = 0;

                // Only calculate stats for members with 'member' role
                const memberRoleMembers = teamMembers.filter(member => member.role === 'member');
                
                memberRoleMembers.forEach(member => {
                  weekDays.forEach(day => {
                    const assignment = assignments.find(a => 
                      a.user_id === member.userId && isSameDay(a.date, day)
                    );
                    
                    if (assignment) {
                      totalAssignments++;
                      if (!assignment.completed) {
                        pending++;
                      } else if (!assignment.completed_at) {
                        completedOnTime++;
                      } else {
                        const completedDate = new Date(assignment.completed_at);
                        const assignmentDate = new Date(assignment.date);
                        assignmentDate.setHours(23, 59, 59, 999);
                        
                        if (completedDate <= assignmentDate) {
                          const assignmentStartOfDay = new Date(assignment.date);
                          assignmentStartOfDay.setHours(0, 0, 0, 0);
                          
                          if (completedDate < assignmentStartOfDay) {
                            completedEarly++;
                          } else {
                            completedOnTime++;
                          }
                        } else {
                          completedLate++;
                        }
                      }
                    }
                  });
                });

                return (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-900">{totalAssignments}</div>
                      <div className="text-sm text-blue-700">Total Assignments</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-900">{completedOnTime + completedEarly}</div>
                      <div className="text-sm text-green-700">Completed</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-900">{completedLate}</div>
                      <div className="text-sm text-red-700">Late Completions</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{pending}</div>
                      <div className="text-sm text-gray-700">Pending</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}