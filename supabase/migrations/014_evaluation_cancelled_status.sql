-- Allow 'cancelled' (set by the auto-close-cycles Edge Function)
ALTER TABLE pf_evaluations
  DROP CONSTRAINT IF EXISTS pf_evaluations_status_check;
ALTER TABLE pf_evaluations
  ADD CONSTRAINT pf_evaluations_status_check
  CHECK (status IN ('pending', 'sent', 'opened', 'submitted', 'cancelled'));
