/*
  # Update delete quiz function to cascade delete study assignments

  1. Function Updates
    - Modify delete_quiz_and_adjust_gamification to also delete associated study assignments
    - Add proper error handling for assignment deletion
    - Maintain transaction integrity

  2. Security
    - Ensure proper authorization checks
    - Maintain existing RLS policies
    - Add logging for cascading deletes
*/

-- Drop the existing function to replace it
DROP FUNCTION IF EXISTS delete_quiz_and_adjust_gamification(uuid, uuid);

-- Create the updated function with cascading assignment deletion
CREATE OR REPLACE FUNCTION delete_quiz_and_adjust_gamification(
  p_quiz_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quiz_session quiz_sessions%ROWTYPE;
  v_assignment_id uuid;
  v_assignment_exists boolean := false;
  v_user_stats user_stats%ROWTYPE;
  v_total_xp_from_sessions integer := 0;
  v_total_bonus_xp integer := 0;
  v_new_total_xp integer := 0;
  v_new_level integer := 1;
  v_longest_streak integer := 0;
  v_current_streak integer := 0;
  v_last_quiz_date date;
BEGIN
  -- Authorization check: Only team owners can delete quiz sessions
  IF NOT (
    SELECT EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = p_user_id 
      AND up.team_role = 'owner'
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners can delete quiz sessions'
    );
  END IF;

  -- Get the quiz session to be deleted
  SELECT * INTO v_quiz_session
  FROM quiz_sessions
  WHERE id = p_quiz_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quiz session not found'
    );
  END IF;

  -- Check if this quiz session has an associated assignment
  v_assignment_id := v_quiz_session.assignment_id;
  IF v_assignment_id IS NOT NULL THEN
    -- Check if the assignment exists
    SELECT EXISTS (
      SELECT 1 FROM study_assignments 
      WHERE id = v_assignment_id
    ) INTO v_assignment_exists;
  END IF;

  -- Begin transaction for atomic operations
  BEGIN
    -- Step 1: Delete associated study assignment if it exists
    IF v_assignment_exists THEN
      DELETE FROM study_assignments 
      WHERE id = v_assignment_id;
      
      -- Log the cascading deletion
      RAISE NOTICE 'Cascading delete: Removed study assignment % associated with quiz session %', 
        v_assignment_id, p_quiz_session_id;
    END IF;

    -- Step 2: Delete quiz question logs first (due to foreign key constraints)
    DELETE FROM quiz_question_logs 
    WHERE quiz_session_id = p_quiz_session_id;

    -- Step 3: Delete the quiz session
    DELETE FROM quiz_sessions 
    WHERE id = p_quiz_session_id;

    -- Step 4: Recalculate user stats after deletion
    -- Get current user stats
    SELECT * INTO v_user_stats
    FROM user_stats
    WHERE user_id = v_quiz_session.user_id;

    -- Recalculate total XP from remaining completed quiz sessions
    SELECT 
      COALESCE(SUM(total_points), 0),
      COALESCE(SUM(bonus_xp), 0)
    INTO v_total_xp_from_sessions, v_total_bonus_xp
    FROM quiz_sessions
    WHERE user_id = v_quiz_session.user_id 
    AND status = 'completed'
    AND approval_status = 'approved';

    v_new_total_xp := v_total_xp_from_sessions + v_total_bonus_xp;
    v_new_level := FLOOR(v_new_total_xp / 500) + 1; -- 500 XP per level

    -- Recalculate study streaks using the streak calculation function
    SELECT 
      COALESCE(calculate_current_study_streak(v_quiz_session.user_id), 0),
      COALESCE(calculate_longest_study_streak(v_quiz_session.user_id), 0)
    INTO v_current_streak, v_longest_streak;

    -- Get the most recent quiz date
    SELECT MAX(DATE(completed_at)) INTO v_last_quiz_date
    FROM quiz_sessions
    WHERE user_id = v_quiz_session.user_id 
    AND status = 'completed'
    AND approval_status = 'approved';

    -- Update user stats with recalculated values
    INSERT INTO user_stats (
      user_id, 
      total_xp, 
      current_level, 
      longest_streak, 
      last_quiz_date,
      created_at,
      updated_at
    )
    VALUES (
      v_quiz_session.user_id,
      v_new_total_xp,
      v_new_level,
      v_longest_streak,
      v_last_quiz_date,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      total_xp = EXCLUDED.total_xp,
      current_level = EXCLUDED.current_level,
      longest_streak = EXCLUDED.longest_streak,
      last_quiz_date = EXCLUDED.last_quiz_date,
      updated_at = NOW();

    -- Step 5: Remove any achievements that are no longer valid
    -- This is a simplified approach - in a full implementation, you might want to
    -- recalculate all achievements to ensure accuracy
    DELETE FROM user_achievements ua
    WHERE ua.user_id = v_quiz_session.user_id
    AND EXISTS (
      SELECT 1 FROM achievements a
      WHERE a.id = ua.achievement_id
      AND (
        (a.criteria_type = 'total_points_earned' AND a.criteria_value > v_new_total_xp) OR
        (a.criteria_type = 'longest_streak' AND a.criteria_value > v_longest_streak)
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Quiz session and associated assignment deleted successfully',
      'assignment_deleted', v_assignment_exists,
      'assignment_id', v_assignment_id,
      'recalculated_stats', jsonb_build_object(
        'total_xp', v_new_total_xp,
        'current_level', v_new_level,
        'longest_streak', v_longest_streak,
        'current_streak', v_current_streak
      )
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to delete quiz session: ' || SQLERRM
      );
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_quiz_and_adjust_gamification(uuid, uuid) TO authenticated;