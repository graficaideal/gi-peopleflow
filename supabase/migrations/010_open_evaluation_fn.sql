-- Ensure anon role has SELECT on all tables needed by the public form.
-- In Supabase the default grants are usually in place, but this makes it
-- explicit so the public page never fails due to missing table-level perms.
GRANT SELECT ON pf_evaluations        TO anon;
GRANT SELECT ON pf_criteria           TO anon;
GRANT SELECT ON pf_employees          TO anon;
GRANT SELECT ON pf_evaluation_cycles  TO anon;
GRANT SELECT ON pf_evaluation_answers TO anon;

-- Re-create the anon SELECT RLS policy (idempotent).
DROP POLICY IF EXISTS "anon_eval_read_by_token" ON pf_evaluations;
CREATE POLICY "anon_eval_read_by_token" ON pf_evaluations
  FOR SELECT TO anon
  USING (token IS NOT NULL);

-- RPC: validate token and transition status to 'opened'.
-- Runs as SECURITY DEFINER so it bypasses RLS for the UPDATE — no anon
-- UPDATE policy is required. Mirrors the pattern of submit_evaluation.
CREATE OR REPLACE FUNCTION public.open_evaluation_by_token(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval_id UUID;
  v_status  TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT id, status, token_expires_at
    INTO v_eval_id, v_status, v_expires
    FROM pf_evaluations
   WHERE token::TEXT = p_token;

  IF v_eval_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RAISE EXCEPTION 'expired';
  END IF;

  IF v_status = 'submitted' THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  -- 'pending' and 'sent' both transition to 'opened'; 'opened' is a no-op
  IF v_status IN ('pending', 'sent') THEN
    UPDATE pf_evaluations SET status = 'opened' WHERE id = v_eval_id;
  END IF;

  RETURN 'opened';
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_evaluation_by_token(TEXT) TO anon;
