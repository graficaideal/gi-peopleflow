-- Log of "average score" emails sent to employees, one row per employee per cycle.
-- Written by the send-score-email edge function (service role); read by the admin app.

CREATE TABLE IF NOT EXISTS pf_score_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES pf_employees(id) ON DELETE CASCADE,
  cycle_id    UUID NOT NULL REFERENCES pf_evaluation_cycles(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, cycle_id)
);

ALTER TABLE pf_score_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON pf_score_notifications;
CREATE POLICY "auth_all" ON pf_score_notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
