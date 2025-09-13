-- Add new columns to plan_settings table
ALTER TABLE public.plan_settings
ADD COLUMN allow_mock_test_creation BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN allow_test_assignments BOOLEAN DEFAULT FALSE NOT NULL;

-- Update Pro and Enterprise plans to have access
UPDATE public.plan_settings
SET
    allow_mock_test_creation = TRUE,
    allow_test_assignments = TRUE
WHERE plan_id IN ('pro', 'enterprise');

-- Ensure Free plan does not have access
UPDATE public.plan_settings
SET
    allow_mock_test_creation = FALSE,
    allow_test_assignments = FALSE
WHERE plan_id = 'free';
