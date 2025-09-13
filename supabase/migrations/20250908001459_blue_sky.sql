CREATE OR REPLACE FUNCTION public.calculate_current_study_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    current_streak_count integer := 0;
    last_completed_date date := NULL;
    current_date_check date := NULL;
BEGIN
    -- Get distinct completed dates for the user, ordered descending
    SELECT DISTINCT DATE(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')
    INTO last_completed_date
    FROM public.quiz_sessions
    WHERE user_id = p_user_id AND status = 'completed'
    ORDER BY DATE(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London') DESC
    LIMIT 1;

    IF last_completed_date IS NULL THEN
        RETURN 0; -- No completed quizzes
    END IF;

    -- Check if the last completed quiz was today or yesterday (in London time)
    current_date_check := (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date;

    IF last_completed_date = current_date_check THEN
        -- Streak includes today
        current_streak_count := 1;
    ELSIF last_completed_date = (current_date_check - INTERVAL '1 day')::date THEN
        -- Streak includes yesterday, but not today yet
        current_streak_count := 1;
    ELSE
        RETURN 0; -- No current streak
    END IF;

    -- Iterate backwards from the last completed date to find consecutive days
    FOR last_completed_date IN
        SELECT DISTINCT DATE(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')
        FROM public.quiz_sessions
        WHERE user_id = p_user_id AND status = 'completed'
        ORDER BY DATE(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London') DESC
    LOOP
        IF last_completed_date = current_date_check THEN
            current_streak_count := current_streak_count + 1;
            current_date_check := (current_date_check - INTERVAL '1 day')::date;
        ELSIF last_completed_date = (current_date_check - INTERVAL '1 day')::date THEN
            -- This handles cases where there might be a gap, but the next day continues the streak
            -- (e.g., if today is Tuesday, and last quiz was Sunday, but we're checking for Monday)
            current_date_check := (current_date_check - INTERVAL '1 day')::date;
            current_streak_count := current_streak_count + 1;
        ELSE
            EXIT; -- Gap found, streak broken
        END IF;
    END LOOP;

    RETURN current_streak_count;
END;
$$;
