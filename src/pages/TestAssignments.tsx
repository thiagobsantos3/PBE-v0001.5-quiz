import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTestAssignments } from '../hooks/useTestAssignments';
import { Layout } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AlertMessage } from '../components/common/AlertMessage';
import { Table, TableColumn } from '../components/common/Table';
import { formatStudyItemsForAssignment } from '../utils/quizHelpers';
import { 
  ArrowLeft,
  ClipboardCheck,
  Play,
  Clock,
  Target,
  BookOpen,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  FileText
} from 'lucide-react';
import { TestAssignment } from '../types';

export function TestAssignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    assignments, 
    assignmentMembers, 
    userQuizSessions,
    loading, 
    error,
    getQuizSessionForTestAssignment
  } = useTestAssignments();

  // Redirect if user does not have access to test assignments
  useEffect(() => {
    if (!user) return; // Wait for user to load
    if (user.planSettings && !user.planSettings.allow_test_assignments) {
      navigate('/quiz', { replace: true });
    }
  }, [user, navigate]);

  // Filter assignments that are assigned to the current user
  const userAssignments = React.useMemo(() => {
    if (!user?.id) return [];
    
    const userAssignmentIds = assignmentMembers
      .filter(member => member.user_id === user.id)
      .map(member => member.test_assignment_id);
    
    return assignments.filter(assignment => 
      userAssignmentIds.includes(assignment.id) && assignment.is_active
    );
  }, [assignments, assignmentMembers, user?.id]);

  const handleStartTest = (assignment: TestAssignment) => {
    // Navigate to test assignment quiz page
    navigate(`/quiz/test-assignment/${assignment.id}`);
  };

  const getAssignmentStatus = (assignmentId: string) => {
    const quizSession = getQuizSessionForTestAssignment(assignmentId, user?.id || '');
    
    if (quizSession) {
      if (quizSession.status === 'completed') {
        return 'completed';
      } else if (quizSession.status === 'active' || quizSession.status === 'paused') {
        return 'started';
      }
    }
    
    // Check if overdue
    if (isOverdue(assignmentId)) {
      return 'overdue';
    }
    
    return 'assigned';
  };

  const getDueDate = (assignmentId: string) => {
    const member = assignmentMembers.find(m => 
      m.test_assignment_id === assignmentId && m.user_id === user?.id
    );
    return member?.due_date;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'started':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const isOverdue = (assignmentId: string) => {
    const dueDate = getDueDate(assignmentId);
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };
  const columns: TableColumn<TestAssignment>[] = [
    {
      key: 'title',
      header: 'Assessment',
      render: (assignment) => (
        <div>
          <div className="font-medium text-gray-900">{assignment.title}</div>
          {assignment.description && (
            <div className="text-sm text-gray-600 mt-1">{assignment.description}</div>
          )}
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-500">
              Created: {new Date(assignment.created_at).toLocaleDateString()}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              Max {assignment.max_questions} questions
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'study_items',
      header: 'Coverage',
      render: (assignment) => (
        <div className="text-sm text-gray-900 max-w-xs">
          {formatStudyItemsForAssignment(assignment.study_items)}
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (assignment) => {
        const dueDate = getDueDate(assignment.id);
        const overdue = isOverdue(assignment.id);
        return (
          <div className="text-sm text-gray-600">
            {dueDate ? (
              <div className={`flex items-center space-x-1 ${overdue ? 'text-red-600' : ''}`}>
                <Calendar className="h-4 w-4 text-orange-600" />
                <span>{new Date(dueDate).toLocaleDateString()}</span>
                {overdue && (
                  <span className="text-xs font-medium text-red-600 ml-1">(Overdue)</span>
                )}
              </div>
            ) : (
              <span className="text-gray-400">No due date</span>
            )}
          </div>
        );
      },
      className: 'text-center hidden md:table-cell',
      headerClassName: 'text-center hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      render: (assignment) => {
        const status = getAssignmentStatus(assignment.id);
        const quizSession = getQuizSessionForTestAssignment(assignment.id, user?.id || '');
        return (
          <div className="text-center space-y-1">
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                {status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                {status === 'started' && <Clock className="h-3 w-3 mr-1" />}
                <span className="capitalize">{status}</span>
              </span>
            </div>
            {quizSession?.approval_status && (
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  quizSession.approval_status === 'approved' 
                    ? 'bg-green-100 text-green-800'
                    : quizSession.approval_status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {quizSession.approval_status}
                </span>
              </div>
            )}
          </div>
        );
      },
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (assignment) => {
        const status = getAssignmentStatus(assignment.id);
        const quizSession = getQuizSessionForTestAssignment(assignment.id, user?.id || '');
        return (
          <div className="text-center">
            {quizSession?.status === 'completed' ? (
              <div className="flex items-center justify-center space-x-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">Completed</span>
              </div>
            ) : quizSession?.status === 'active' || quizSession?.status === 'paused' ? (
              <button
                onClick={() => navigate(`/quiz/test-runner/${quizSession.id}`)}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg text-sm transition-colors duration-200 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Play className="h-3 w-3" />
                <span>Resume Assessment</span>
              </button>
            ) : (
              <button
                onClick={() => handleStartTest(assignment)}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg text-sm transition-colors duration-200 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Play className="h-3 w-3" />
                <span>Start Assessment</span>
              </button>
            )}
          </div>
        );
      },
      className: 'text-center',
      headerClassName: 'text-center',
    },
  ];

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner fullScreen text="Loading test assignments..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6">
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

        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
              <p className="text-gray-600">
                Complete formal assessments and mock tests assigned by your team administrators.
              </p>
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

        {/* Assessment Table */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <ClipboardCheck className="h-6 w-6 text-red-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Available Assessments</h2>
                <p className="text-sm text-gray-600">
                  Formal assessments and evaluations assigned to you by team administrators.
                </p>
              </div>
            </div>
          </div>

          <Table
            columns={columns}
            data={userAssignments}
            loading={loading}
            getRowClassName={(assignment) => {
              const status = getAssignmentStatus(assignment.id);
              const overdue = isOverdue(assignment.id);
              if (overdue && status !== 'completed') {
                return 'bg-red-50 border-l-4 border-red-400';
              }
              return '';
            }}
            emptyState={{
              icon: ClipboardCheck,
              title: "No Assessments",
              description: "You don't have any assessments at the moment. Your team administrators will assign them when available.",
              action: (
                <button
                  onClick={() => navigate('/quiz')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                >
                  Back to Quiz Center
                </button>
              )
            }}
          />

          {userAssignments.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{userAssignments.length}</div>
                  <div className="text-sm text-gray-600">Total Assignments</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {userAssignments.filter(a => getAssignmentStatus(a.id) === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {userAssignments.filter(a => getAssignmentStatus(a.id) === 'started').length}
                  </div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {userAssignments.filter(a => isOverdue(a.id) && getAssignmentStatus(a.id) !== 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Overdue</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Information Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-2">About Assessments</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>
                  Assessments are formal evaluations created by your team administrators to evaluate 
                  your knowledge and progress in specific areas of the Pathfinder Bible Experience.
                </p>
                <ul className="list-disc list-inside space-y-1 mt-3">
                  <li>Tests may have time limits and specific evaluation criteria</li>
                  <li>You will type your answers, which will be auto-graded and reviewed</li>
                  <li>Results contribute to your overall progress tracking</li>
                  <li>Complete tests by their due dates when specified</li>
                  <li>You can challenge any marking you disagree with during the review phase</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}