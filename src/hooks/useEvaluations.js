import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useEvaluations() {
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pf_evaluations')
      .select(`
        id, type, status, submitted_at, cycle_id, created_at, token, token_expires_at,
        cycle:pf_evaluation_cycles(id, name, anonymous, end_date),
        evaluatee:pf_employees!evaluatee_id(id, full_name, employee_number, email),
        evaluator:pf_employees!evaluator_id(id, full_name, employee_number, email)
      `)
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setEvaluations(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { evaluations, loading, error, refetch: load }
}
