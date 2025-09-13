import React from 'react';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { StudyAssignment, TeamMemberForSchedule } from '../../types';
import { formatDateForDisplay, addDays, isSameDay } from '../../utils/dateUtils';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface TeamWeeklyScheduleTableProps {
  teamMembers: TeamMemberForSchedule[];
  allAssignments: StudyAssignment[];
  loading: boolean;
  currentWeekStart: Date; // Monday of the current week
  weekDays: Date[];
  onNavigateWeek: (direction: 'prev' | 'next') => void;
}

type AssignmentStatus = 'completed_on_time' | 'completed_early' | 'completed_late' | 'pending' | 'no_assignment';

export function TeamWeeklyScheduleTable({
  teamMembers,
  allAssignments,
  loading,
  currentWeekStart,
  weekDays,
  onNavigateWeek
}: TeamWeeklyScheduleTableProps) {
  const { developerLog } = useAuth();

  // Get assignment status for a specific member and date
  const getAssignmentStatus = React.useCallback((memberId: string, date: Date): AssignmentStatus => {
    const assignment = allAssignments.find(a => 
      a.user_id === memberId && isSameDay(a.date, date)
    );

    // Debug the assignment lookup for Friday specifically
    if (date.getDay() === 5) { // Friday
      developerLog('🔍 TeamWeeklyScheduleTable: Friday assignment lookup:', {
        memberId,
        fridayDate: date.toISOString(),
        fridayDateString: date.toDateString(),
        foundAssignment: !!assignment,
        assignmentId: assignment?.id,
        memberAssignments: allAssignments
          .filter(a => a.user_id === memberId)
          .map(a => ({
            id: a.id.substring(0, 8),
            date: a.date.toISOString().split('T')[0],
            dayOfWeek: a.date.getDay(),
            matches: isSameDay(a.date, date)
          }))
      });
    }

    if (!assignment) {
      return 'no_assignment';
    }

    if (!assignment.completed) {
      return 'pending';
    }

    if (!assignment.completed_at) {
      return 'completed_on_time'; // Fallback if no completion time
    }

    const completedDate = new Date(assignment.completed_at);
    const assignmentDate = new Date(assignment.date);
    
    // Set assignment date to end of day for comparison
    assignmentDate.setHours(23, 59, 59, 999);
    
    if (completedDate <= assignmentDate) {
      // Check if completed early (before the assignment date)
      const assignmentStartOfDay = new Date(assignment.date);
      assignmentStartOfDay.setHours(0, 0, 0, 0);
      
      if (completedDate < assignmentStartOfDay) {
        return 'completed_early';
      }
      return 'completed_on_time';
    } else {
      return 'completed_late';
    }
  }, [allAssignments]);

  // Get status icon and color
  const getStatusIcon = (status: AssignmentStatus) => {
    switch (status) {
      case 'completed_on_time':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'completed_early':
        return <CheckCircle className="h-5 w-5 text-orange-500" />;
      case 'completed_late':
        return <CheckCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      case 'no_assignment':
        return null;
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <LoadingSpinner text="Loading team schedule..." className="py-8" />
      </div>
    );
  }

  // Filter to only show members with 'member' role
  const memberRoleMembers = teamMembers.filter(member => member.role === 'member');

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header with week navigation */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team Weekly Schedule</h2>
            <p className="text-sm text-gray-600">
              Week of {formatDateForDisplay(currentWeekStart, { month: 'long', day: 'numeric' })} - {formatDateForDisplay(addDays(currentWeekStart, 6), { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              title="Previous week"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={() => onNavigateWeek('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              title="Next week"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team Member
              </th>
              {weekDays.map((day, index) => (
                <th key={day.toISOString()} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>
                    <div className="font-semibold">{dayNames[index]}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {formatDateForDisplay(day, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {memberRoleMembers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No team members found
                </td>
              </tr>
            ) : (
              memberRoleMembers.map((member) => (
                <tr key={member.userId} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-indigo-600">
                          {member.user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{member.user.name}</div>
                        <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((day) => {
                    const status = getAssignmentStatus(member.userId, day);
                    const icon = getStatusIcon(status);
                    
                    return (
                      <td key={`${member.userId}-${day.toISOString()}`} className="px-3 py-4 text-center">
                        <div className="flex justify-center">
                          {icon}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-gray-700">Completed on time</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-gray-700">Completed early</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-gray-700">Completed late</span>
          </div>
          <div className="flex items-center space-x-2">
            <XCircle className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700">Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}