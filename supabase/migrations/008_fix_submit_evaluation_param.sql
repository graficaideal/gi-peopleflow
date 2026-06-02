-- Fix: p_token declared as UUID causes "operator does not exist: text = uuid"
-- because JavaScript always sends strings and PostgreSQL has no implicit text→uuid cast.
-- Change parameter to TEXT and compare using token::TEXT to be safe regardless
-- of whether the token column is UUID or TEXT.

CREATE OR REPLACE FUNCTION public.submit_evaluation(
  p_token   TEXT,
  p_answers JSONB,
  p_notes   TEXT DEFAULT NULL
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
   WHERE token::TEXT = p_token;

  IF v_eval_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou não encontrado.';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION 'Link expirado.';
  END IF;

  IF v_status = 'submitted' THEN
    RAISE EXCEPTION 'Avaliação já submetida.';
  END IF;

  DELETE FROM pf_evaluation_answers WHERE evaluation_id = v_eval_id;

  INSERT INTO pf_evaluation_answers (evaluation_id, criteria_id, score)
  SELECT
    v_eval_id,
    (ans->>'criteria_id')::UUID,
    (ans->>'score')::INT
  FROM jsonb_array_elements(p_answers) AS ans;

  UPDATE pf_evaluations SET
    status           = 'submitted',
    submitted_at     = now(),
    notes            = p_notes,
    token            = NULL,
    token_expires_at = NULL
  WHERE id = v_eval_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_evaluation(TEXT, JSONB, TEXT) TO anon;

-- Drop the old UUID-typed overload if it exists
DROP FUNCTION IF EXISTS public.submit_evaluation(UUID, JSONB, TEXT);
