-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.delete_quiz_and_adjust_gamification(uuid, uuid);

-- Create or replace the delete_quiz_and_adjust_gamification function
CREATE OR REPLACE FUNCTION public.delete_quiz_and_adjust_gamification(
    p_quiz_session_id uuid,
    p_user_id uuid -- The ID of the user attempting the deletion
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Important for accessing user_profiles and team_members
AS $$
DECLARE
    quiz_session_record record;
    user_profile_record record;
    is_team_owner_or_admin boolean;
    is_system_admin boolean;
BEGIN
    -- Set search_path for security definer function
    PERFORM set_config('search_path', 'public', TRUE);

    -- Get the quiz session details
    SELECT *
    INTO quiz_session_record
    FROM public.quiz_sessions
    WHERE id = p_quiz_session_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', FALSE, 'error', 'Quiz session not found.');
    END IF;

    -- Get the user's profile attempting the deletion
    SELECT *
    INTO user_profile_record
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', FALSE, 'error', 'User attempting deletion not found.');
    END IF;

    -- Check if the user attempting deletion is a system admin
    is_system_admin := (user_profile_record.role = 'admin');

    -- Check if the user attempting deletion is a team owner or admin for the quiz's team
    is_team_owner_or_admin := FALSE;
    IF quiz_session_record.team_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.team_members
            WHERE user_id = p_user_id
              AND team_id = quiz_session_record.team_id
              AND (role = 'owner' OR role = 'admin')
        ) INTO is_team_owner_or_admin;
    END IF;

    -- Logic for deletion based on quiz status and user role
    IF quiz_session_record.status = 'active' THEN
        -- Allow user to delete their own active quiz
        IF quiz_session_record.user_id = p_user_id THEN
            DELETE FROM public.quiz_sessions WHERE id = p_quiz_session_id;
            RETURN json_build_object('success', TRUE, 'message', 'Active quiz session deleted successfully.');
        ELSE
            RETURN json_build_object('success', FALSE, 'error', 'You can only delete your own active quiz sessions.');
        END IF;
    ELSIF quiz_session_record.status = 'completed' THEN
        -- Allow team owners/admins or system admins to delete completed quizzes
        IF is_system_admin OR is_team_owner_or_admin THEN
            DELETE FROM public.quiz_sessions WHERE id = p_quiz_session_id;
            -- The tg_recompute_user_stats trigger will handle gamification adjustment
            RETURN json_build_object('success', TRUE, 'message', 'Completed quiz session deleted successfully and gamification adjusted.');
        ELSE
            RETURN json_build_object('success', FALSE, 'error', 'Only team owners, admins, or system administrators can delete completed quiz sessions.');
        END IF;
    ELSE
        RETURN json_build_object('success', FALSE, 'error', 'Quiz session cannot be deleted in its current status.');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- Create or replace the tg_recompute_user_stats trigger function
CREATE OR REPLACE FUNCTION public.tg_recompute_user_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Needed for cross-table access (user_stats, user_achievements, achievements)
AS $$
DECLARE
    _user_id uuid;
    _total_xp integer;
    _current_level integer;
    _longest_streak integer;
    _last_quiz_date date;
    _all_completed_sessions_for_streak jsonb;
    _all_completed_sessions_for_xp jsonb;
BEGIN
    -- Set search_path for security definer function
    PERFORM set_config('search_path', 'public', TRUE);

    -- Determine the user_id based on the operation
    IF TG_OP = 'DELETE' THEN
        _user_id := OLD.user_id;
        -- Only recompute gamification for COMPLETED quizzes on DELETE
        IF OLD.status <> 'completed' THEN
            RETURN OLD; -- Exit if not a completed quiz deletion
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        _user_id := NEW.user_id;
        -- Only recompute gamification for COMPLETED quizzes on INSERT
        IF NEW.status <> 'completed' THEN
            RETURN NEW; -- Exit if not a completed quiz insertion
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        _user_id := NEW.user_id;
        -- Only recompute gamification if status or bonus_xp changed to 'completed'
        -- or if total_points changed for a completed quiz
        IF (NEW.status = 'completed' AND (OLD.status <> 'completed' OR NEW.total_points IS DISTINCT FROM OLD.total_points OR NEW.bonus_xp IS DISTINCT FROM OLD.bonus_xp)) THEN
            -- Continue with recomputation
        ELSE
            RETURN NEW; -- Exit if no relevant change for gamification
        END IF;
    ELSE
        RETURN NULL; -- Should not happen
    END IF;

    -- Fetch all completed quiz sessions for the user for XP and streak calculation
    SELECT jsonb_agg(jsonb_build_object('total_points', qs.total_points, 'completed_at', qs.completed_at, 'bonus_xp', qs.bonus_xp))
    INTO _all_completed_sessions_for_xp
    FROM public.quiz_sessions qs
    WHERE qs.user_id = _user_id AND qs.status = 'completed';

    SELECT jsonb_agg(jsonb_build_object('completed_at', qs.completed_at))
    INTO _all_completed_sessions_for_streak
    FROM public.quiz_sessions qs
    WHERE qs.user_id = _user_id AND qs.status = 'completed';

    -- Calculate total XP from all completed sessions
    _total_xp := COALESCE((
        SELECT SUM(CAST(elem->>'total_points' AS INTEGER) + COALESCE(CAST(elem->>'bonus_xp' AS INTEGER), 0))
        FROM jsonb_array_elements(_all_completed_sessions_for_xp) AS elem
    ), 0);

    -- Calculate current level
    _current_level := FLOOR(_total_xp / 500) + 1; -- Assuming 500 XP per level

    -- Calculate longest streak using a more robust SQL method (Gaps and Islands)
    -- This requires a subquery to identify consecutive days
    WITH dated_sessions AS (
        SELECT
            CAST(elem->>'completed_at' AS DATE) AS completed_date
        FROM jsonb_array_elements(_all_completed_sessions_for_streak) AS elem
        WHERE elem->>'completed_at' IS NOT NULL
        GROUP BY CAST(elem->>'completed_at' AS DATE)
    ),
    streaks AS (
        SELECT
            completed_date,
            completed_date - ROW_NUMBER() OVER (ORDER BY completed_date) AS grp
        FROM dated_sessions
    )
    SELECT COALESCE(MAX(COUNT(*)), 0)
    INTO _longest_streak
    FROM streaks
    GROUP BY grp;

    -- Determine last quiz date
    SELECT MAX(CAST(elem->>'completed_at' AS TIMESTAMP WITH TIME ZONE))::date
    INTO _last_quiz_date
    FROM jsonb_array_elements(_all_completed_sessions_for_xp) AS elem;

    -- Upsert user_stats
    INSERT INTO public.user_stats (user_id, total_xp, current_level, longest_streak, last_quiz_date)
    VALUES (_user_id, _total_xp, _current_level, _longest_streak, _last_quiz_date)
    ON CONFLICT (user_id) DO UPDATE
    SET
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        longest_streak = GREATEST(user_stats.longest_streak, EXCLUDED.longest_streak), -- Keep the max longest streak
        last_quiz_date = EXCLUDED.last_quiz_date,
        updated_at = now();

    -- Trigger achievement checks (this would typically be handled by another function or external service)
    -- For simplicity, we assume achievements are checked client-side or by a separate process.

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Ensure the update_updated_at_column function exists and is correct
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist to ensure clean recreation
DROP TRIGGER IF EXISTS quiz_sessions_recompute_after_del ON public.quiz_sessions;
DROP TRIGGER IF EXISTS quiz_sessions_recompute_after_ins ON public.quiz_sessions;
DROP TRIGGER IF EXISTS quiz_sessions_recompute_after_upd ON public.quiz_sessions;

-- Re-create triggers for tg_recompute_user_stats
CREATE TRIGGER quiz_sessions_recompute_after_del
AFTER DELETE ON public.quiz_sessions
FOR EACH ROW EXECUTE FUNCTION tg_recompute_user_stats();

CREATE TRIGGER quiz_sessions_recompute_after_ins
AFTER INSERT ON public.quiz_sessions
FOR EACH ROW EXECUTE FUNCTION tg_recompute_user_stats();

CREATE TRIGGER quiz_sessions_recompute_after_upd
AFTER UPDATE OF status, approval_status, total_points, bonus_xp, completed_at ON public.quiz_sessions
FOR EACH ROW EXECUTE FUNCTION tg_recompute_user_stats();

-- Ensure triggers for updated_at are also set up for quiz_sessions if they aren't already
DROP TRIGGER IF EXISTS update_quiz_sessions_updated_at ON public.quiz_sessions;
CREATE TRIGGER update_quiz_sessions_updated_at
BEFORE UPDATE ON public.quiz_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();