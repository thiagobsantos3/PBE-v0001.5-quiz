/*
  # Fix date - bigint type mismatch in tg_recompute_user_stats function

  1. Problem
    - The tg_recompute_user_stats function has a type mismatch error
    - PostgreSQL cannot subtract BIGINT (ROW_NUMBER()) from DATE directly
    - Error: "operator does not exist: date - bigint"

  2. Solution
    - Convert DATE to INTEGER (days since reference date) before subtraction
    - Use '2000-01-01' as reference date to convert dates to integers
    - This allows proper arithmetic with ROW_NUMBER() result

  3. Changes
    - Modify the streaks CTE in tg_recompute_user_stats function
    - Change: completed_date - ROW_NUMBER() OVER (ORDER BY completed_date) AS grp
    - To: (completed_date - '2000-01-01'::date) - ROW_NUMBER() OVER (ORDER BY completed_date) AS grp
*/

CREATE OR REPLACE FUNCTION tg_recompute_user_stats()
RETURNS TRIGGER AS $$
DECLARE
    _user_id UUID;
    _all_completed_sessions_for_streak JSONB;
    _total_xp INTEGER;
    _current_level INTEGER;
    _longest_streak INTEGER;
    _last_quiz_date DATE;
BEGIN
    -- Determine user_id from the trigger context
    IF TG_OP = 'DELETE' THEN
        _user_id := OLD.user_id;
    ELSE
        _user_id := NEW.user_id;
    END IF;

    -- Fetch all completed quiz sessions for this user (for streak calculation)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'completed_at', completed_at
        )
    ), '[]'::jsonb)
    INTO _all_completed_sessions_for_streak
    FROM quiz_sessions
    WHERE user_id = _user_id 
      AND status = 'completed' 
      AND completed_at IS NOT NULL
      AND (approval_status IS NULL OR approval_status = 'approved');

    -- Calculate total XP from all completed, approved quiz sessions
    SELECT COALESCE(SUM(total_points + COALESCE(bonus_xp, 0)), 0)
    INTO _total_xp
    FROM quiz_sessions
    WHERE user_id = _user_id 
      AND status = 'completed'
      AND (approval_status IS NULL OR approval_status = 'approved');

    -- Calculate current level based on total XP
    _current_level := FLOOR(_total_xp / 500) + 1;

    -- Calculate longest streak using the islands and gaps technique
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
            (completed_date - '2000-01-01'::date) - ROW_NUMBER() OVER (ORDER BY completed_date) AS grp
        FROM dated_sessions
    )
    SELECT COALESCE(MAX(COUNT(*)), 0)
    INTO _longest_streak
    FROM streaks
    GROUP BY grp;

    -- Get the most recent quiz date
    SELECT MAX(CAST(completed_at AS DATE))
    INTO _last_quiz_date
    FROM quiz_sessions
    WHERE user_id = _user_id 
      AND status = 'completed'
      AND (approval_status IS NULL OR approval_status = 'approved');

    -- Upsert user stats
    INSERT INTO user_stats (
        user_id,
        total_xp,
        current_level,
        longest_streak,
        last_quiz_date,
        created_at,
        updated_at
    ) VALUES (
        _user_id,
        _total_xp,
        _current_level,
        _longest_streak,
        _last_quiz_date,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        longest_streak = EXCLUDED.longest_streak,
        last_quiz_date = EXCLUDED.last_quiz_date,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;