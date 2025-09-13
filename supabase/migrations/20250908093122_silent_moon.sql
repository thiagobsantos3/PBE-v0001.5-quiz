ALTER TABLE public.quiz_sessions
DROP CONSTRAINT quiz_sessions_type_check;

ALTER TABLE public.quiz_sessions
ADD CONSTRAINT quiz_sessions_type_check CHECK (type = ANY (ARRAY['quick-start'::text, 'custom'::text, 'study-assignment'::text, 'mock-test'::text]));
