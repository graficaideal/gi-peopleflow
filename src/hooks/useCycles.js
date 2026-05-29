import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateEvaluationsForCycle } from '../utils/generateEvaluations'

export function useCycles() {
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pf_evaluation_cycles')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setCycles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createCycle = async (values) => {
    if (values.status === 'active') {
      await supabase.from('pf_evaluation_cycles').update({ status: 'draft' }).eq('status', 'active')
    }
    const { data, error: err } = await supabase
      .from('pf_evaluation_cycles').insert(values).select().single()
    if (err) throw err
    if (values.status === 'active') {
      await generateEvaluationsForCycle(data.id)
    }
    await load()
  }

  const updateCycle = async (id, values) => {
    if (values.status === 'active') {
      await supabase.from('pf_evaluation_cycles').update({ status: 'draft' }).eq('status', 'active').neq('id', id)
    }
    const { error: err } = await supabase.from('pf_evaluation_cycles').update(values).eq('id', id)
    if (err) throw err
    if (values.status === 'active') {
      await generateEvaluationsForCycle(id)
    }
    await load()
  }

  const deleteCycle = async (id) => {
    const { error: err } = await supabase.from('pf_evaluation_cycles').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { cycles, loading, error, refetch: load, createCycle, updateCycle, deleteCycle }
}
