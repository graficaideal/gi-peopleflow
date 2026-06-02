-- Allow anon to delete their own answers before re-inserting on retry.
-- Required because EvaluationPublic does DELETE + INSERT to handle re-submission.

DROP POLICY IF EXISTS "anon_answers_delete" ON pf_evaluation_answers;
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
