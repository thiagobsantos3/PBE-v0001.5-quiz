CREATE OR REPLACE FUNCTION public.get_team_owner_plan_settings(p_team_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_team_owner_id UUID;
  v_subscription RECORD;
  v_plan_settings RECORD;
  v_result JSON;
BEGIN
  -- Get the team owner ID
  SELECT owner_id INTO v_team_owner_id
  FROM teams
  WHERE id = p_team_id;
  
  IF v_team_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Get the team owner's subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = v_team_owner_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no subscription found, return free plan settings
  IF v_subscription IS NULL THEN
    SELECT * INTO v_plan_settings
    FROM plan_settings
    WHERE plan_id = 'free';
  ELSE
    -- Get plan settings for the subscription plan
    SELECT * INTO v_plan_settings
    FROM plan_settings
    WHERE plan_id = v_subscription.plan;
  END IF;

  -- Return the plan settings
  IF v_plan_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Plan settings not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'plan_settings', json_build_object(
      'id', v_plan_settings.id,
      'plan_id', v_plan_settings.plan_id,
      'max_questions_custom_quiz', v_plan_settings.max_questions_custom_quiz,
      'max_team_members', v_plan_settings.max_team_members,
      'question_tier_access', v_plan_settings.question_tier_access,
      'allow_quick_start_quiz', v_plan_settings.allow_quick_start_quiz,
      'allow_create_own_quiz', v_plan_settings.allow_create_own_quiz,
      'allow_study_schedule_quiz', v_plan_settings.allow_study_schedule_quiz,
      'allow_analytics_access', v_plan_settings.allow_analytics_access,
      -- ADD THESE TWO LINES:
      'allow_mock_test_creation', v_plan_settings.allow_mock_test_creation,
      'allow_test_assignments', v_plan_settings.allow_test_assignments,
      'created_at', v_plan_settings.created_at,
      'updated_at', v_plan_settings.updated_at
    ),
    'subscription_plan', COALESCE(v_subscription.plan, 'free'),
    'team_owner_id', v_team_owner_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Failed to get team owner plan settings: ' || SQLERRM);
END;
$function$;
