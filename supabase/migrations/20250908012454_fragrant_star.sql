-- 1. Create test_assignments table
CREATE TABLE public.test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    study_items JSONB NOT NULL,
    max_questions INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- Enable Row Level Security (RLS) for test_assignments (policies will be added later)
ALTER TABLE public.test_assignments ENABLE ROW LEVEL SECURITY;


-- 2. Create test_assignment_members table (needed for test_assignments RLS policy)
CREATE TABLE public.test_assignment_members (
    test_assignment_id UUID NOT NULL REFERENCES public.test_assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    due_date DATE,
    status TEXT DEFAULT 'assigned' NOT NULL,
    PRIMARY KEY (test_assignment_id, user_id)
);

-- Enable Row Level Security (RLS) for test_assignment_members (policies will be added later)
ALTER TABLE public.test_assignment_members ENABLE ROW LEVEL SECURITY;


-- 3. Alter quiz_sessions to add the new columns and foreign key
ALTER TABLE public.quiz_sessions
ADD COLUMN is_temporary_result BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN challenge_status TEXT DEFAULT 'none' NOT NULL,
ADD COLUMN auto_graded_score NUMERIC,
ADD COLUMN test_assignment_id UUID;

-- Add foreign key constraint for test_assignment_id (now test_assignments exists)
ALTER TABLE public.quiz_sessions
ADD CONSTRAINT quiz_sessions_test_assignment_id_fkey
FOREIGN KEY (test_assignment_id) REFERENCES public.test_assignments(id) ON DELETE SET NULL;


-- 4. Alter quiz_question_logs
ALTER TABLE public.quiz_question_logs
ADD COLUMN typed_answer TEXT,
ADD COLUMN review_status TEXT DEFAULT 'pending' NOT NULL;


-- 5. Create test_challenges table
CREATE TABLE public.test_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_description TEXT NOT NULL,
    raised_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending' NOT NULL,
    admin_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security (RLS) for test_challenges (policies will be added later)
ALTER TABLE public.test_challenges ENABLE ROW LEVEL SECURITY;


-- 6. Add RLS Policies (now that all tables are created)

-- RLS Policies for test_assignments
CREATE POLICY "Team owners/admins can manage test assignments" ON public.test_assignments
FOR ALL USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = (SELECT team_id FROM public.user_profiles WHERE id = auth.uid()) AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = (SELECT team_id FROM public.user_profiles WHERE id = auth.uid()) AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

CREATE POLICY "Users can view their assigned tests" ON public.test_assignments
FOR SELECT USING (EXISTS (SELECT 1 FROM public.test_assignment_members tam WHERE tam.test_assignment_id = id AND tam.user_id = auth.uid()));


-- RLS Policies for test_challenges
CREATE POLICY "Users can insert their own test challenges" ON public.test_challenges
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own test challenges" ON public.test_challenges
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all test challenges" ON public.test_challenges
FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));


-- RLS Policies for test_assignment_members
CREATE POLICY "Team owners/admins can manage test assignment members" ON public.test_assignment_members
FOR ALL USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = (SELECT team_id FROM public.user_profiles WHERE id = auth.uid()) AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = (SELECT team_id FROM public.user_profiles WHERE id = auth.uid()) AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

CREATE POLICY "Users can view their own test assignment memberships" ON public.test_assignment_members
FOR SELECT USING (user_id = auth.uid());


-- 7. Add indexes for performance
CREATE INDEX idx_test_challenges_quiz_session_id ON public.test_challenges (quiz_session_id);
CREATE INDEX idx_test_challenges_user_id ON public.test_challenges (user_id);
CREATE INDEX idx_test_assignments_assigned_by ON public.test_assignments (assigned_by);
CREATE INDEX idx_test_assignment_members_user_id ON public.test_assignment_members (user_id);
