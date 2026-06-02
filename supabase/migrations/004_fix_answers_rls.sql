-- upsert (INSERT ON CONFLICT DO UPDATE) requires both INSERT and UPDATE policies.
-- The anon UPDATE policy was missing, causing the "violates row-level security" error.

DROP POLICY IF EXISTS "anon_answers_update" ON pf_evaluation_answers;
CREATE POLICY "anon_answers_update" ON pf_evaluation_answers
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM pf_evaluations e
      WHERE e.id = evaluation_id
        AND e.token IS NOT NULL
        AND e.status <> 'submitted'
    )
  )
  WITH CHECK (true);
