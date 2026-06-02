-- Add token-based evaluation link support

-- Add token columns to pf_evaluations
ALTER TABLE pf_evaluations
  ADD COLUMN IF NOT EXISTS token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Add email to pf_employees (if not already present)
ALTER TABLE pf_employees
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Update status constraint to include 'sent' and 'opened'
ALTER TABLE pf_evaluations
  DROP CONSTRAINT IF EXISTS pf_evaluations_status_check;
ALTER TABLE pf_evaluations
  ADD CONSTRAINT pf_evaluations_status_check
  CHECK (status IN ('pending', 'sent', 'opened', 'submitted'));

-- -------------------------------------------------------
-- RLS policies for public (anon) token access
-- Run the block below ONLY if RLS is enabled on your tables.
-- -------------------------------------------------------
/*
CREATE POLICY "anon_read_evaluation_by_token"
  ON pf_evaluations FOR SELECT TO anon
  USING (token IS NOT NULL);

CREATE POLICY "anon_update_evaluation_by_token"
  ON pf_evaluations FOR UPDATE TO anon
  USING (token IS NOT NULL AND status NOT IN ('submitted'))
  WITH CHECK (status IN ('opened', 'submitted'));

CREATE POLICY "anon_read_criteria"
  ON pf_criteria FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_employees"
  ON pf_employees FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_cycles"
  ON pf_evaluation_cycles FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_answers"
  ON pf_evaluation_answers FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pf_evaluations e
      WHERE e.id = evaluation_id
        AND e.token IS NOT NULL
        AND e.token_expires_at > now()
        AND e.status != 'submitted'
    )
  );
*/
