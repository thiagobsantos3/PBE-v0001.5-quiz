-- Allow users to update their own quiz_question_logs (for marking challenges)
DROP POLICY IF EXISTS "Users can update their own quiz question logs" ON public.quiz_question_logs;
CREATE POLICY "Users can update their own quiz question logs"
ON public.quiz_question_logs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- Extend quiz_sessions.type to include 'assessment'
ALTER TABLE public.quiz_sessions
DROP CONSTRAINT IF EXISTS quiz_sessions_type_check;

ALTER TABLE public.quiz_sessions
ADD CONSTRAINT quiz_sessions_type_check 
CHECK (type = ANY (ARRAY['quick-start'::text, 'custom'::text, 'study-assignment'::text, 'mock-test'::text, 'assessment'::text]));