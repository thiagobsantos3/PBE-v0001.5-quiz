-- Fix tg_recompute_user_stats to remove nested aggregates and guard execution
-- This addresses "aggregate function calls cannot be nested" (code 42803)
-- and avoids recomputation for non-completed quiz sessions.

CREATE OR REPLACE FUNCTION public.tg_recompute_user_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _user_id uuid;
    _total_xp integer;
    _current_level integer;
    _longest_streak integer;
    _last_quiz_date date;
BEGIN
    -- Ensure search_path for security definer
    PERFORM set_config('search_path', 'public', TRUE);

    -- Determine context and guard for relevant events only
    IF TG_OP = 'DELETE' THEN
        _user_id := OLD.user_id;
        IF OLD.status <> 'completed' THEN
            RETURN OLD;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        _user_id := NEW.user_id;
        IF NEW.status <> 'completed' THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        _user_id := NEW.user_id;
        -- Only recompute when transitioning to completed or when completed quiz totals change
        IF NOT (
            NEW.status = 'completed' AND (
                OLD.status <> 'completed'
                OR NEW.total_points IS DISTINCT FROM OLD.total_points
                OR NEW.bonus_xp IS DISTINCT FROM OLD.bonus_xp
                OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
            )
        ) THEN
            RETURN NEW;
        END IF;
    ELSE
        RETURN NULL; -- unreachable
    END IF;

    -- Compute total XP and last quiz date from completed, approved sessions
    SELECT
        COALESCE(SUM(qs.total_points + COALESCE(qs.bonus_xp, 0)), 0) AS total_xp,
        MAX(CAST(qs.completed_at AS DATE)) AS last_quiz_date
    INTO _total_xp, _last_quiz_date
    FROM public.quiz_sessions qs
    WHERE qs.user_id = _user_id
      AND qs.status = 'completed'
      AND (qs.approval_status IS NULL OR qs.approval_status = 'approved');

    _current_level := FLOOR(_total_xp / 500) + 1; -- 500 XP per level

    -- Compute longest streak (gaps and islands) without nested aggregates
    WITH dates AS (
        SELECT DISTINCT CAST(qs.completed_at AS DATE) AS d
        FROM public.quiz_sessions qs
        WHERE qs.user_id = _user_id
          AND qs.status = 'completed'
          AND qs.completed_at IS NOT NULL
          AND (qs.approval_status IS NULL OR qs.approval_status = 'approved')
    ),
    streaks AS (
        SELECT
            d,
            (d - '2000-01-01'::date) - ROW_NUMBER() OVER (ORDER BY d) AS grp
        FROM dates
    ),
    counts AS (
        SELECT COUNT(*) AS cnt FROM streaks GROUP BY grp
    )
    SELECT COALESCE(MAX(cnt), 0) INTO _longest_streak FROM counts;

    -- Upsert user_stats (keep max longest_streak historically)
    INSERT INTO public.user_stats (user_id, total_xp, current_level, longest_streak, last_quiz_date)
    VALUES (_user_id, _total_xp, _current_level, _longest_streak, _last_quiz_date)
    ON CONFLICT (user_id) DO UPDATE SET
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        longest_streak = GREATEST(user_stats.longest_streak, EXCLUDED.longest_streak),
        last_quiz_date = EXCLUDED.last_quiz_date,
        updated_at = now();

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;