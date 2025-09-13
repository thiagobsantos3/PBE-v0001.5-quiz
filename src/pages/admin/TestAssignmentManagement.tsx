import React, { useState } from 'react';
import { useTestAssignments } from '../../hooks/useTestAssignments';
import { TestAssignmentModal } from '../../components/admin/TestAssignmentModal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertMessage } from '../../components/common/AlertMessage';
import { Table, TableColumn } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { formatStudyItemsForAssignment } from '../../utils/quizHelpers';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Target,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { TestAssignment } from '../../types';

export function TestAssignmentManagement() {
  const navigate = useNavigate();
  const { 
    assignments, 
    assignmentMembers,
    loading, 
    error, 
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getAssignmentSummary
  } = useTestAssignments();
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TestAssignment | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddAssignment = () => {
    setEditingAssignment(null);
    setSaveError(null);
    setShowAssignmentModal(true);
  };

  const handleEditAssignment = (assignment: TestAssignment) => {
    setEditingAssignment(assignment);
    setSaveError(null);
    setShowAssignmentModal(true);
  };

  const handleSaveAssignment = async (
    assignmentData: Omit<TestAssignment, 'id' | 'created_at' | 'updated_at'>,
    memberIds: string[]
  ) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await createAssignment(assignmentData, memberIds);
      setShowAssignmentModal(false);
    } catch (error: any) {
      console.error('Error creating test assignment:', error);
      setSaveError(error.message || 'Failed to create test assignment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAssignment = async (
    assignmentId: string,
    updates: Partial<TestAssignment>,
    memberIds: string[]
  ) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await updateAssignment(assignmentId, updates);
      // TODO: Update assignment members if needed
      setShowAssignmentModal(false);
    } catch (error: any) {
      console.error('Error updating test assignment:', error);
      setSaveError(error.message || 'Failed to update test assignment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string, assignmentTitle: string) => {
    if (!confirm(`Are you sure you want to delete the test assignment "${assignmentTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteAssignment(assignmentId);
    } catch (error: any) {
      console.error('Error deleting test assignment:', error);
      setSaveError(error.message || 'Failed to delete test assignment');
    } finally {
      setIsSaving(false);
    }
  };

  // Get assigned member count for an assignment
  const getAssignedMemberCount = (assignmentId: string) => {
    return assignmentMembers.filter(member => member.test_assignment_id === assignmentId).length;
  };

  // Define table columns for Test Assignments
  const columns: TableColumn<TestAssignment>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (assignment) => (
        <div className="font-medium text-gray-900">{assignment.title}</div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (assignment) => (
        <div className="text-sm text-gray-600 line-clamp-2">
          {assignment.description || 'No description'}
        </div>
      ),
    },
    {
      key: 'max_questions',
      header: 'Max Qs',
      render: (assignment) => (
        <div className="flex items-center justify-center space-x-1">
          <Target className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-gray-900">{assignment.max_questions}</span>
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'study_items',
      header: 'Study Coverage',
      render: (assignment) => (
        <div className="text-sm text-gray-900">
          {formatStudyItemsForAssignment(assignment.study_items)}
        </div>
      ),
    },
    {
      key: 'assigned_members',
      header: 'Assigned To',
      render: (assignment) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 mb-1">
            {getAssignedMemberCount(assignment.id)} member{getAssignedMemberCount(assignment.id) !== 1 ? 's' : ''}
          </div>
          {(() => {
            const summary = getAssignmentSummary(assignment.id);
            return (
              <div className="text-xs text-gray-600">
                {summary.completedCount > 0 ? (
                  <>
                    <div>{summary.completedCount} completed</div>
                    <div className="font-medium text-blue-600">
                      {summary.averageScore}% avg score
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500">No completions yet</div>
                )}
              </div>
            );
          })()}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (assignment) => (
        assignment.is_active ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />
      ),
      className: 'text-center',
    },
    {
      key: 'created_at',
      header: 'Created At',
      render: (assignment) => (
        <span className="text-sm text-gray-500">
          {new Date(assignment.created_at).toLocaleDateString()}
        </span>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'actions',
      header: '',
      render: (assignment) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/admin/test-assessments/${assignment.id}`)}
            className="text-blue-600 hover:text-blue-700 transition-colors duration-200"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleEditAssignment(assignment)}
            className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200"
            title="Edit assignment"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteAssignment(assignment.id, assignment.title)}
            className="text-red-600 hover:text-red-700 transition-colors duration-200"
            title="Delete assignment"
            disabled={isSaving}
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  if (loading) {
    return (
      <LoadingSpinner fullScreen text="Loading test assignments..." />
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <AlertMessage type="error" message={error} className="mb-6" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <ClipboardCheck className="h-6 w-6 text-red-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Assessments</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Create, manage, and assign formal assessment tests to users.
            </p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleAddAssignment}
          >
            Create New Test
          </Button>
        </div>

        <Table
          columns={columns}
          data={assignments}
          loading={loading}
          emptyState={{
            icon: ClipboardCheck,
            title: "No Test Assignments Found",
            description: "No test assignments have been created yet. Click the button above to create your first test.",
            action: (
              <Button
                variant="primary"
                icon={Plus}
                onClick={handleAddAssignment}
              >
                Create First Test
              </Button>
            )
          }}
        />

        {/* Test Assignment Modal */}
        <TestAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => {
            setShowAssignmentModal(false);
            setEditingAssignment(null);
            setSaveError(null);
          }}
          onSave={handleSaveAssignment}
          onUpdate={handleUpdateAssignment}
          editingAssignment={editingAssignment}
          loading={isSaving}
          error={saveError}
        />
        {/* Save Error Message */}
        {saveError && (
          <AlertMessage
            type="error"
            message={saveError}
            className="mb-6"
            dismissible
            onDismiss={() => setSaveError(null)}
          />
        )}
      </div>
  );
}

export default TestAssignmentManagement;