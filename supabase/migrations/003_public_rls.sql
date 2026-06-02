-- RLS policies for the public evaluation page (/avaliar/:token)
-- Run this in the Supabase SQL Editor.
-- DROP + CREATE pattern avoids "policy already exists" errors on re-runs.

-- ── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE pf_evaluations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_evaluation_cycles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_criteria           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_evaluation_answers ENABLE ROW LEVEL SECURITY;

-- ── Authenticated users — full access (preserves existing admin app) ─────────
DROP POLICY IF EXISTS "auth_all" ON pf_evaluations;
CREATE POLICY "auth_all" ON pf_evaluations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON pf_employees;
CREATE POLICY "auth_all" ON pf_employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON pf_evaluation_cycles;
CREATE POLICY "auth_all" ON pf_evaluation_cycles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON pf_criteria;
CREATE POLICY "auth_all" ON pf_criteria
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON pf_evaluation_answers;
CREATE POLICY "auth_all" ON pf_evaluation_answers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Anon — public evaluation flow ────────────────────────────────────────────

-- Read own evaluation by token
DROP POLICY IF EXISTS "anon_eval_read_by_token" ON pf_evaluations;
CREATE POLICY "anon_eval_read_by_token" ON pf_evaluations
  FOR SELECT TO anon
  USING (token IS NOT NULL);

-- Update status (sent→opened, opened→submitted) and clear token on submit
DROP POLICY IF EXISTS "anon_eval_update_by_token" ON pf_evaluations;
CREATE POLICY "anon_eval_update_by_token" ON pf_evaluations
  FOR UPDATE TO anon
  USING (token IS NOT NULL AND status <> 'submitted')
  WITH CHECK (status IN ('opened', 'submitted'));

-- Read employee names (needed for evaluatee display in the form)
DROP POLICY IF EXISTS "anon_employees_read" ON pf_employees;
CREATE POLICY "anon_employees_read" ON pf_employees
  FOR SELECT TO anon USING (true);

-- Read cycle name and end_date
DROP POLICY IF EXISTS "anon_cycles_read" ON pf_evaluation_cycles;
CREATE POLICY "anon_cycles_read" ON pf_evaluation_cycles
  FOR SELECT TO anon USING (true);

-- Read active criteria
DROP POLICY IF EXISTS "Public read criteria" ON pf_criteria;
CREATE POLICY "Public read criteria" ON pf_criteria
  FOR SELECT TO anon USING (true);

-- Insert answers only for evaluations that have a valid open token
DROP POLICY IF EXISTS "anon_answers_insert" ON pf_evaluation_answers;
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
