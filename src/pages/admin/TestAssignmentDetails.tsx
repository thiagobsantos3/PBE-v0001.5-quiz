import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTestAssignments } from '../../hooks/useTestAssignments';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertMessage } from '../../components/common/AlertMessage';
import { Table, TableColumn } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { formatStudyItemsForAssignment } from '../../utils/quizHelpers';
import { formatTimeAgo } from '../../utils/formatters';
import {
  ArrowLeft,
  ClipboardCheck,
  Users,
  Target,
  Award,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  TrendingUp,
  Eye,
  Flag
} from 'lucide-react';

interface AssignmentMemberDetail {
  userId: string;
  name: string;
  email: string;
  assignedAt: string;
  dueDate?: string;
  status: string;
  scorePercentage: number;
  totalPoints: number;
  maxPoints: number;
  questionsCount: number;
  completedAt?: string;
  timeSpentMinutes: number;
  approvalStatus?: string;
  suspicionStatus?: string;
  suspicionScore?: number;
  quizSessionId?: string;
}

interface AssignmentDetails {
  assignment: any;
  memberDetails: AssignmentMemberDetail[];
  totalAssigned: number;
  completedCount: number;
  averageScore: number;
}

export function TestAssignmentDetails() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { getAssignmentDetails, loading: assignmentsLoading } = useTestAssignments();
  
  const [details, setDetails] = useState<AssignmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) {
      setError('Assignment ID not provided');
      setLoading(false);
      return;
    }
    if (assignmentsLoading) return; // Wait until assignments are loaded in the hook

    loadAssignmentDetails();
  }, [assignmentId, assignmentsLoading]);

  const loadAssignmentDetails = async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);
      setError(null);

      const assignmentDetails = await getAssignmentDetails(assignmentId);
      
      if (!assignmentDetails) {
        setError('Assessment not found or you do not have access to view it');
        return;
      }

      setDetails(assignmentDetails);
    } catch (err: any) {
      console.error('Error loading assignment details:', err);
      setError(err.message || 'Failed to load assessment details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'In Progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Overdue':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSuspicionColor = (status?: string) => {
    switch (status) {
      case 'red':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'amber':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'green':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const columns: TableColumn<AssignmentMemberDetail>[] = [
    {
      key: 'rank',
      header: 'Rank',
      render: (_, index) => (
        <div className="text-center">
          <div className="font-bold text-lg text-gray-900">#{index + 1}</div>
        </div>
      ),
      className: 'text-center w-16',
      headerClassName: 'text-center',
    },
    {
      key: 'name',
      header: 'Team Member',
      render: (member) => (
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-indigo-600">
              {member.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900">{member.name}</div>
            <div className="text-sm text-gray-500">{member.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (member) => (
        <div className="text-center">
          <div className={`text-2xl font-bold ${getScoreColor(member.scorePercentage)}`}>
            {member.scorePercentage}%
          </div>
          <div className="text-xs text-gray-500">
            {member.totalPoints}/{member.maxPoints} pts
          </div>
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'questions',
      header: 'Questions',
      render: (member) => (
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1">
            <Target className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-gray-900">{member.questionsCount}</span>
          </div>
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'time_spent',
      header: 'Time Spent',
      render: (member) => (
        <div className="text-center">
          {member.timeSpentMinutes > 0 ? (
            <div className="flex items-center justify-center space-x-1">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-gray-900">{member.timeSpentMinutes}m</span>
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => (
        <div className="text-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(member.status)}`}>
            {member.status === 'Completed' && <CheckCircle className="h-3 w-3 mr-1" />}
            {member.status === 'In Progress' && <Clock className="h-3 w-3 mr-1" />}
            {member.status === 'Overdue' && <AlertTriangle className="h-3 w-3 mr-1" />}
            <span>{member.status}</span>
          </span>
          {member.approvalStatus && (
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                member.approvalStatus === 'approved' 
                  ? 'bg-green-100 text-green-800'
                  : member.approvalStatus === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {member.approvalStatus}
              </span>
            </div>
          )}
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'integrity',
      header: 'Integrity',
      render: (member) => (
        <div className="text-center">
          {member.suspicionStatus ? (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSuspicionColor(member.suspicionStatus)}`}>
              <span className={`h-2 w-2 rounded-full mr-1 ${
                member.suspicionStatus === 'red' ? 'bg-red-500' :
                member.suspicionStatus === 'amber' ? 'bg-yellow-500' : 'bg-green-500'
              }`}></span>
              <span className="capitalize">{member.suspicionStatus}</span>
              {member.suspicionScore !== undefined && (
                <span className="ml-1 text-gray-500">
                  {Math.round(member.suspicionScore * 100)}%
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'completed_at',
      header: 'Completed',
      render: (member) => (
        <div className="text-sm text-gray-600">
          {member.completedAt ? (
            <div>
              <div>{new Date(member.completedAt).toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">
                {formatTimeAgo(member.completedAt)}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (member) => (
        <div className="text-center">
          {member.quizSessionId && (
            <button
              onClick={() => navigate(`/quiz/test-review/${member.quizSessionId}`)}
              className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200"
              title="View quiz details"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
  ];

  if (loading || assignmentsLoading) {
    return (
      <LoadingSpinner fullScreen text="Loading assessment details..." />
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/admin/test-assessments')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Assessments</span>
          </button>
        </div>
        <AlertMessage type="error" message={error} />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/admin/test-assessments')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Assessments</span>
          </button>
        </div>
        <div className="text-center py-12">
          <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Assessment Not Found</h2>
          <p className="text-gray-600">The requested assessment could not be found.</p>
        </div>
      </div>
    );
  }

  const { assignment, memberDetails, totalAssigned, completedCount, averageScore } = details;

  return (
    <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/admin/test-assessments')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Assessments</span>
          </button>
        </div>

        {/* Assessment Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
              <p className="text-gray-600">
                {assignment.description || 'Assessment details and member performance'}
              </p>
            </div>
          </div>

          {/* Assessment Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Test Coverage</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900">{formatStudyItemsForAssignment(assignment.study_items)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Max Questions</h4>
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-gray-900">{assignment.max_questions}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Created</h4>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span className="text-gray-900">{new Date(assignment.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-900">{totalAssigned}</div>
                <div className="text-sm text-blue-700">Total Assigned</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-900">{completedCount}</div>
                <div className="text-sm text-green-700">Completed</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className={`text-2xl font-bold ${getScoreColor(averageScore)}`}>
                  {averageScore}%
                </div>
                <div className="text-sm text-purple-700">Average Score</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-900">
                  {Math.round((completedCount / totalAssigned) * 100)}%
                </div>
                <div className="text-sm text-orange-700">Completion Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Member Performance Table */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Member Performance</h2>
                <p className="text-sm text-gray-600">
                  Detailed results for all team members assigned to this assessment
                </p>
              </div>
            </div>
          </div>

          <Table
            columns={columns}
            data={memberDetails}
            loading={loading}
            emptyState={{
              icon: Users,
              title: "No Members Assigned",
              description: "No team members have been assigned to this assessment yet."
            }}
            getRowClassName={(member) => {
              // Highlight different statuses
              if (member.status === 'Overdue') {
                return 'bg-red-50 border-l-4 border-red-400';
              } else if (member.status === 'Completed' && member.scorePercentage >= 90) {
                return 'bg-green-50 border-l-4 border-green-400';
              } else if (member.suspicionStatus === 'red') {
                return 'bg-yellow-50 border-l-4 border-yellow-400';
              }
              return '';
            }}
          />

          {memberDetails.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{memberDetails.length}</div>
                  <div className="text-sm text-gray-600">Total Members</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {memberDetails.filter(m => m.status === 'Completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {memberDetails.filter(m => m.status === 'In Progress').length}
                  </div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {memberDetails.filter(m => m.status === 'Overdue').length}
                  </div>
                  <div className="text-sm text-gray-600">Overdue</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-600">
                    {memberDetails.filter(m => m.suspicionStatus === 'red' || m.suspicionStatus === 'amber').length}
                  </div>
                  <div className="text-sm text-gray-600">Flagged</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Performance Insights */}
        {memberDetails.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span>Performance Insights</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Score Distribution</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">90-100% (Excellent)</span>
                    <span className="font-medium text-green-600">
                      {memberDetails.filter(m => m.scorePercentage >= 90).length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">80-89% (Good)</span>
                    <span className="font-medium text-blue-600">
                      {memberDetails.filter(m => m.scorePercentage >= 80 && m.scorePercentage < 90).length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">70-79% (Fair)</span>
                    <span className="font-medium text-yellow-600">
                      {memberDetails.filter(m => m.scorePercentage >= 70 && m.scorePercentage < 80).length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Below 70% (Needs Improvement)</span>
                    <span className="font-medium text-red-600">
                      {memberDetails.filter(m => m.scorePercentage < 70 && m.status === 'Completed').length} members
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Completion Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completed on Time</span>
                    <span className="font-medium text-green-600">
                      {memberDetails.filter(m => 
                        m.status === 'Completed' && 
                        (!m.dueDate || (m.completedAt && new Date(m.completedAt) <= new Date(m.dueDate)))
                      ).length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completed Late</span>
                    <span className="font-medium text-orange-600">
                      {memberDetails.filter(m => 
                        m.status === 'Completed' && 
                        m.dueDate && m.completedAt && new Date(m.completedAt) > new Date(m.dueDate)
                      ).length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="font-medium text-blue-600">
                      {memberDetails.filter(m => m.status === 'In Progress').length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Not Started</span>
                    <span className="font-medium text-gray-600">
                      {memberDetails.filter(m => m.status === 'Not Started').length} members
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}