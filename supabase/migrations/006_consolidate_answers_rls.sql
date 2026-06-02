-- Consolidates all anon RLS policies for pf_evaluation_answers.
-- Replaces migrations 004 and 005. Run this in the Supabase SQL Editor.

DROP POLICY IF EXISTS "anon_answers_insert" ON pf_evaluation_answers;
DROP POLICY IF EXISTS "anon_answers_update" ON pf_evaluation_answers;
DROP POLICY IF EXISTS "anon_answers_delete" ON pf_evaluation_answers;

-- INSERT: needed for the initial save of scores
CREATE POLICY "anon_answers_insert" ON pf_evaluation_answers
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pf_evaluations e
      WHERE e.id = evaluation_id
        AND e.token IS NOT NULL
        AND e.status <> 'submitted'
    )
  );

-- UPDATE: needed because UPSERT (INSERT ON CONFLICT DO UPDATE) evaluates
-- both INSERT and UPDATE policies; without this the conflict branch is denied
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

-- DELETE: needed to clear previous answers before re-inserting on retry
CREATE POLICY "anon_answers_delete" ON pf_evaluation_answers
  FOR DELETE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM pf_evaluations e
      WHERE e.id = evaluation_id
        AND e.token IS NOT NULL
        AND e.status <> 'submitted'
    )
  );
