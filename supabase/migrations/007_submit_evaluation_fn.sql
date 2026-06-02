-- Single atomic function for public evaluation submission.
-- Runs as SECURITY DEFINER (bypasses RLS) so no per-operation anon policies
-- are needed on pf_evaluation_answers.
-- Replaces the client-side DELETE + INSERT/UPSERT pattern.

CREATE OR REPLACE FUNCTION public.submit_evaluation(
  p_token  UUID,
  p_answers JSONB,       -- [{ "criteria_id": "uuid", "score": 1-5 }, ...]
  p_notes  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval_id    UUID;
  v_expires_at TIMESTAMPTZ;
  v_status     TEXT;
BEGIN
  SELECT id, token_expires_at, status
    INTO v_eval_id, v_expires_at, v_status
    FROM pf_evaluations
   WHERE token = p_token;

  IF v_eval_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou não encontrado.';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION 'Link expirado.';
  END IF;

  IF v_status = 'submitted' THEN
    RAISE EXCEPTION 'Avaliação já submetida.';
  END IF;

  -- Clear any previous partial answers
  DELETE FROM pf_evaluation_answers WHERE evaluation_id = v_eval_id;

  -- Insert the new answers
  INSERT INTO pf_evaluation_answers (evaluation_id, criteria_id, score)
  SELECT
    v_eval_id,
    (ans->>'criteria_id')::UUID,
    (ans->>'score')::INT
  FROM jsonb_array_elements(p_answers) AS ans;

  -- Finalise the evaluation
  UPDATE pf_evaluations SET
    status          = 'submitted',
    submitted_at    = now(),
    notes           = p_notes,
    token           = NULL,
    token_expires_at = NULL
  WHERE id = v_eval_id;
END;
$$;

-- Grant execute to the anon role used by the public page
GRANT EXECUTE ON FUNCTION public.submit_evaluation(UUID, JSONB, TEXT) TO anon;
