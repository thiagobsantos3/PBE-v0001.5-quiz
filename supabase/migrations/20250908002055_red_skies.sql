CREATE OR REPLACE FUNCTION public.calculate_longest_study_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    longest_streak integer := 0;
    current_streak integer := 0;
    last_date date := NULL;
    current_date date;
BEGIN
    -- Get distinct completed dates for the user, ordered ascending
    FOR current_date IN
        SELECT DISTINCT (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date
        FROM public.quiz_sessions
        WHERE user_id = p_user_id AND status = 'completed'
        ORDER BY (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date ASC
    LOOP
        IF last_date IS NULL THEN
            -- First date in the sequence
            current_streak := 1;
        ELSIF current_date = (last_date + INTERVAL '1 day')::date THEN
            -- Consecutive day
            current_streak := current_streak + 1;
        ELSE
            -- Gap found, reset streak
            current_streak := 1;
        END IF;

        -- Update longest streak if current streak is greater
        IF current_streak > longest_streak THEN
            longest_streak := current_streak;
        END IF;

        last_date := current_date;
    END LOOP;

    RETURN longest_streak;
END;
$$;
