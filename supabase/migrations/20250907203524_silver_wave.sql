-- Create ENUM type for report status
CREATE TYPE public.quiz_report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- Create the quiz_problem_reports table
CREATE TABLE public.quiz_problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    problem_description TEXT NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status public.quiz_report_status DEFAULT 'pending'::public.quiz_report_status,
    question_text_snapshot TEXT,
    answer_text_snapshot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE public.quiz_problem_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own quiz problem reports
CREATE POLICY "Users can view their own quiz problem reports"
ON public.quiz_problem_reports FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Admins can view all quiz problem reports
CREATE POLICY "Admins can view all quiz problem reports"
ON public.quiz_problem_reports FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE public.user_profiles.id = auth.uid() AND public.user_profiles.role = 'admin'));

-- RLS Policy: Users can insert their own quiz problem reports
CREATE POLICY "Users can insert their own quiz problem reports"
ON public.quiz_problem_reports FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own quiz problem reports (e.g., to add more details if allowed by UI)
CREATE POLICY "Users can update their own quiz problem reports"
ON public.quiz_problem_reports FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Admins can update all quiz problem reports
CREATE POLICY "Admins can update all quiz problem reports"
ON public.quiz_problem_reports FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE public.user_profiles.id = auth.uid() AND public.user_profiles.role = 'admin'))
WITH CHECK (true);

-- RLS Policy: Admins can delete quiz problem reports
CREATE POLICY "Admins can delete quiz problem reports"
ON public.quiz_problem_reports FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE public.user_profiles.id = auth.uid() AND public.user_profiles.role = 'admin'));

-- Indexes for performance on commonly queried columns
CREATE INDEX idx_quiz_problem_reports_user_id ON public.quiz_problem_reports (user_id);
CREATE INDEX idx_quiz_problem_reports_quiz_session_id ON public.quiz_problem_reports (quiz_session_id);
CREATE INDEX idx_quiz_problem_reports_question_id ON public.quiz_problem_reports (question_id);
CREATE INDEX idx_quiz_problem_reports_status ON public.quiz_problem_reports (status);

-- Trigger to automatically update the 'updated_at' timestamp on row modification
CREATE TRIGGER update_quiz_problem_reports_updated_at
BEFORE UPDATE ON public.quiz_problem_reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
