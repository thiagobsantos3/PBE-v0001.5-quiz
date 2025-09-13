import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TestAssignment, TestAssignmentMember } from '../types';

export function useTestAssignments() {
  const { user, developerLog } = useAuth();
  const [assignments, setAssignments] = useState<TestAssignment[]>([]);
  const [assignmentMembers, setAssignmentMembers] = useState<TestAssignmentMember[]>([]);
  const [allQuizSessions, setAllQuizSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!user) {
      setAssignments([]);
      setAssignmentMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      developerLog('📥 Loading test assignments for user:', user.id);

      // Fetch all active test assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('test_assignments')
        .select('*, test_questions') // Select the new test_questions column
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        console.error('❌ Error loading test assignments:', assignmentsError);
        throw assignmentsError;
      }

      // Fetch assignment members to determine which assignments are assigned to the current user
      const { data: membersData, error: membersError } = await supabase
        .from('test_assignment_members')
        .select('*')
        .order('assigned_at', { ascending: false });

      if (membersError) {
        console.error('❌ Error loading test assignment members:', membersError);
        throw membersError;
      }

      developerLog('✅ Test assignments loaded:', assignmentsData?.length || 0, 'assignments');
      developerLog('✅ Assignment members loaded:', membersData?.length || 0, 'members');

      // Fetch ALL quiz sessions for test assignments (not just current user)
      const { data: allQuizSessionsData, error: quizSessionsError } = await supabase
        .from('quiz_sessions')
        .select(`
          id, 
          test_assignment_id, 
          user_id, 
          status, 
          approval_status, 
          completed_at, 
          total_points, 
          max_points,
          total_actual_time_spent_seconds,
          suspicion_status,
          suspicion_score,
          questions,
          created_at
        `)
        .not('test_assignment_id', 'is', null)
        .order('created_at', { ascending: false });

      if (quizSessionsError) {
        console.error('❌ Error loading all quiz sessions for test assignments:', quizSessionsError);
        setAllQuizSessions([]);
      } else {
        developerLog('✅ All quiz sessions for test assignments loaded:', allQuizSessionsData?.length || 0, 'sessions');
        setAllQuizSessions(allQuizSessionsData || []);
      }

      // Parse test_questions from JSON string back to array
      const parsedAssignments = (assignmentsData || []).map(assignment => ({
        ...assignment,
        test_questions: assignment.test_questions 
          ? JSON.parse(assignment.test_questions) 
          : null
      }));

      setAssignments(parsedAssignments);
      setAssignmentMembers(membersData || []);

    } catch (err: any) {
      console.error('💥 Error loading test assignments:', err);
      setError(err.message || 'Failed to load test assignments');
      setAssignments([]);
      setAssignmentMembers([]);
    } finally {
      setLoading(false);
    }
  }, [user, developerLog]);

  const getQuizSessionForTestAssignment = useCallback((testAssignmentId: string, userId: string) => {
    return allQuizSessions.find(session => 
      session.test_assignment_id === testAssignmentId && session.user_id === userId
    ) || null;
  }, [allQuizSessions]);

  const getAssignmentSummary = useCallback((assignmentId: string) => {
    const assignmentSessions = allQuizSessions.filter(session => 
      session.test_assignment_id === assignmentId && session.status === 'completed'
    );
    
    if (assignmentSessions.length === 0) {
      return { completedCount: 0, averageScore: 0 };
    }
    
    const totalScore = assignmentSessions.reduce((sum, session) => {
      const score = session.max_points > 0 ? (session.total_points / session.max_points) * 100 : 0;
      return sum + score;
    }, 0);
    
    return {
      completedCount: assignmentSessions.length,
      averageScore: Math.round(totalScore / assignmentSessions.length)
    };
  }, [allQuizSessions]);

  const getAssignmentDetails = useCallback(async (assignmentId: string) => {
    if (!user?.teamId) return null;

    try {
      // Get assignment details
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return null;

      // Get all members assigned to this test
      const testMembers = assignmentMembers.filter(member => 
        member.test_assignment_id === assignmentId
      );

      // Get user profiles for assigned members
      const memberIds = testMembers.map(m => m.user_id);
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .in('id', memberIds);

      if (profilesError) {
        console.error('❌ Error loading user profiles:', profilesError);
        throw profilesError;
      }

      // Get quiz sessions for this assignment
      const assignmentSessions = allQuizSessions.filter(session => 
        session.test_assignment_id === assignmentId
      );

      // Combine member data with their quiz session data
      const memberDetails = testMembers.map(member => {
        const userProfile = userProfiles?.find(p => p.id === member.user_id);
        const quizSession = assignmentSessions.find(s => s.user_id === member.user_id);
        
        let status = 'Not Started';
        let scorePercentage = 0;
        
        if (quizSession) {
          if (quizSession.status === 'completed') {
            status = 'Completed';
            scorePercentage = quizSession.max_points > 0 
              ? Math.round((quizSession.total_points / quizSession.max_points) * 100)
              : 0;
          } else if (quizSession.status === 'active' || quizSession.status === 'paused') {
            status = 'In Progress';
          }
        }
        
        // Check if overdue
        if (member.due_date && new Date(member.due_date) < new Date() && status !== 'Completed') {
          status = 'Overdue';
        }
        
        return {
          userId: member.user_id,
          name: userProfile?.name || 'Unknown User',
          email: userProfile?.email || '',
          assignedAt: member.assigned_at,
          dueDate: member.due_date,
          status,
          scorePercentage,
          totalPoints: quizSession?.total_points || 0,
          maxPoints: quizSession?.max_points || 0,
          questionsCount: quizSession?.questions?.length || assignment.max_questions,
          completedAt: quizSession?.completed_at,
          timeSpentMinutes: quizSession?.total_actual_time_spent_seconds 
            ? Math.round(quizSession.total_actual_time_spent_seconds / 60) 
            : 0,
          approvalStatus: quizSession?.approval_status,
          suspicionStatus: quizSession?.suspicion_status,
          suspicionScore: quizSession?.suspicion_score,
          quizSessionId: quizSession?.id
        };
      });

      // Sort by score percentage (highest first)
      memberDetails.sort((a, b) => b.scorePercentage - a.scorePercentage);

      return {
        assignment,
        memberDetails,
        totalAssigned: testMembers.length,
        completedCount: memberDetails.filter(m => m.status === 'Completed').length,
        averageScore: memberDetails.length > 0 
          ? Math.round(memberDetails.reduce((sum, m) => sum + m.scorePercentage, 0) / memberDetails.length)
          : 0
      };
    } catch (error) {
      console.error('💥 Error getting assignment details:', error);
      throw error;
    }
  }, [assignments, assignmentMembers, allQuizSessions, user?.teamId]);

  const createAssignment = useCallback(async (
    assignment: Omit<TestAssignment, 'id' | 'created_at' | 'updated_at'>, 
    memberIds: string[]
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    try {
      setLoading(true);
      setError(null);

      developerLog('📝 Creating test assignment:', assignment);
      developerLog('🔍 DEBUG: test_questions from assignment object:', {
        testQuestionsLength: assignment.test_questions?.length,
        testQuestionsArray: assignment.test_questions,
        testQuestionsType: typeof assignment.test_questions,
        isArray: Array.isArray(assignment.test_questions)
      });

      // Create the test assignment with explicit test_questions inclusion
      const insertPayload = {
        ...assignment,
        assigned_by: user.id,
        test_questions: assignment.test_questions ? JSON.stringify(assignment.test_questions) : null
      };
      
      developerLog('🔍 DEBUG: Insert payload being sent to database:', {
        insertPayload,
        testQuestionsInPayload: insertPayload.test_questions,
        testQuestionsStringified: typeof insertPayload.test_questions === 'string'
      });
      
      const { data: newAssignment, error: assignmentError } = await supabase
        .from('test_assignments')
        .insert([insertPayload])
        .select()
        .single();

      if (assignmentError) {
        console.error('❌ Error creating test assignment:', assignmentError);
        developerLog('❌ DEBUG: Database insertion error details:', {
          error: assignmentError,
          message: assignmentError.message,
          code: assignmentError.code,
          details: assignmentError.details,
          hint: assignmentError.hint
        });
        throw assignmentError;
      }

      developerLog('✅ Test assignment created:', newAssignment);
      developerLog('🔍 DEBUG: Created assignment test_questions field:', {
        testQuestionsFromDb: newAssignment.test_questions,
        testQuestionsLengthFromDb: newAssignment.test_questions?.length,
        testQuestionsTypeFromDb: typeof newAssignment.test_questions
      });

      // Assign members to the test
      if (memberIds.length > 0) {
        const memberAssignments = memberIds.map(memberId => ({
          test_assignment_id: newAssignment.id,
          user_id: memberId,
          status: 'assigned' as const,
        }));

        const { error: membersError } = await supabase
          .from('test_assignment_members')
          .insert(memberAssignments);

        if (membersError) {
          console.error('❌ Error assigning members to test:', membersError);
          throw membersError;
        }

        developerLog('✅ Members assigned to test:', memberIds.length, 'members');
      }

      // Refresh data
      await fetchAssignments();

    } catch (error) {
      console.error('💥 Error creating test assignment:', error);
      setError('Failed to create test assignment');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, fetchAssignments, developerLog]);

  const updateAssignment = useCallback(async (
    assignmentId: string,
    updates: Partial<TestAssignment>
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      developerLog('📝 Updating test assignment:', assignmentId, updates);
      developerLog('🔍 DEBUG: test_questions from updates object:', {
        testQuestionsLength: updates.test_questions?.length,
        testQuestionsArray: updates.test_questions,
        hasTestQuestions: !!updates.test_questions
      });
      
      const updatePayload: any = { 
        ...updates, 
        updated_at: new Date().toISOString()
      };
      
      // Explicitly include test_questions if provided
      if (updates.test_questions) {
        updatePayload.test_questions = JSON.stringify(updates.test_questions);
      }
      
      developerLog('🔍 DEBUG: Update payload being sent to database:', {
        updatePayload,
        testQuestionsInPayload: updatePayload.test_questions,
        testQuestionsStringified: typeof updatePayload.test_questions === 'string'
      });

      const { data: updatedAssignment, error } = await supabase
        .from('test_assignments')
        .update(updatePayload)
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating test assignment:', error);
        developerLog('❌ DEBUG: Database update error details:', {
          error: error,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      developerLog('✅ Test assignment updated successfully');
      developerLog('🔍 DEBUG: Updated assignment test_questions field:', {
        testQuestionsFromDb: updatedAssignment?.test_questions,
        testQuestionsLengthFromDb: updatedAssignment?.test_questions?.length,
        testQuestionsTypeFromDb: typeof updatedAssignment?.test_questions
      });

      // Refresh data
      await fetchAssignments();

    } catch (error) {
      console.error('💥 Error updating test assignment:', error);
      setError('Failed to update test assignment');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAssignments, developerLog]);

  const deleteAssignment = useCallback(async (assignmentId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      developerLog('🗑️ Deleting test assignment:', assignmentId);

      // First delete assignment members
      const { error: membersError } = await supabase
        .from('test_assignment_members')
        .delete()
        .eq('test_assignment_id', assignmentId);

      if (membersError) {
        console.error('❌ Error deleting assignment members:', membersError);
        throw membersError;
      }

      // Then delete the assignment
      const { error } = await supabase
        .from('test_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) {
        console.error('❌ Error deleting test assignment:', error);
        throw error;
      }

      developerLog('✅ Test assignment deleted successfully');

      // Refresh data
      await fetchAssignments();

    } catch (error) {
      console.error('💥 Error deleting test assignment:', error);
      setError('Failed to delete test assignment');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAssignments, developerLog]);

  const getAssignmentById = useCallback((assignmentId: string): TestAssignment | null => {
    developerLog('🔍 getAssignmentById: Starting search for assignment ID:', assignmentId);
    developerLog('🔍 getAssignmentById: Current user ID:', user?.id);
    developerLog('🔍 getAssignmentById: Available assignments:', assignments.map(a => ({ 
      id: a.id, 
      title: a.title, 
      is_active: a.is_active,
      assigned_by: a.assigned_by 
    })));
    developerLog('🔍 getAssignmentById: All assignment members:', assignmentMembers.map(m => ({
      test_assignment_id: m.test_assignment_id,
      user_id: m.user_id,
      status: m.status
    })));
    developerLog('🔍 getAssignmentById: Assignment members for current user:', assignmentMembers.filter(m => m.user_id === user?.id));
    
    // First check if the user is assigned to this test
    const isUserAssigned = assignmentMembers.some(member => 
      member.test_assignment_id === assignmentId && member.user_id === user?.id
    );
    
    developerLog('🔍 getAssignmentById: Is user assigned to this test?', {
      assignmentId,
      userId: user?.id,
      isUserAssigned,
      matchingMembers: assignmentMembers.filter(m => 
        m.test_assignment_id === assignmentId && m.user_id === user?.id
      )
    });
    
    if (!isUserAssigned) {
      developerLog('❌ getAssignmentById: User is not assigned to this test assignment:', assignmentId);
      return null;
    }
    
    // Search the already loaded 'assignments' array
    const foundAssignment = assignments.find(a => a.id === assignmentId);
    
    developerLog('🔍 getAssignmentById: Assignment search result:', {
      assignmentId,
      foundAssignment: foundAssignment ? {
        id: foundAssignment.id,
        title: foundAssignment.title,
        is_active: foundAssignment.is_active,
        assigned_by: foundAssignment.assigned_by
      } : null
    });
    
    if (!foundAssignment) {
      developerLog('⚠️ getAssignmentById: Test assignment not found in loaded assignments:', assignmentId);
      developerLog('🔍 getAssignmentById: This could mean RLS is filtering it out or it doesn\'t exist');
      return null;
    }
    
    // Check if assignment is active
    if (!foundAssignment.is_active) {
      developerLog('⚠️ getAssignmentById: Test assignment found but is not active:', {
        assignmentId,
        is_active: foundAssignment.is_active
      });
      return null;
    }

    developerLog('✅ getAssignmentById: Test assignment found and accessible:', {
      id: foundAssignment.id,
      title: foundAssignment.title,
      is_active: foundAssignment.is_active,
      study_items: foundAssignment.study_items,
      max_questions: foundAssignment.max_questions
    });
    return foundAssignment;
  }, [assignments, developerLog]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return {
    assignments,
    assignmentMembers,
    allQuizSessions,
    loading,
    error,
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getAssignmentById,
    getQuizSessionForTestAssignment,
    getAssignmentSummary,
    getAssignmentDetails,
  };
}