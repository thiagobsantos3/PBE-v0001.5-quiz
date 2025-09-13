CREATE POLICY "Team owners/admins can update quiz question logs for their team"
ON public.quiz_question_logs
FOR UPDATE
TO authenticated
USING (
  (EXISTS (
    SELECT 1
    FROM public.quiz_sessions qs
    WHERE qs.id = quiz_question_logs.quiz_session_id
      AND qs.team_id IN (
        SELECT tm.team_id
        FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
          AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
  ))
  OR (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin' -- System admin
  ))
);
