import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useDepartments() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pf_departments')
      .select('*, teams:pf_teams(*)')
      .order('name')
    if (err) { setError(err.message); setLoading(false); return }
    setDepartments(
      (data ?? []).map(d => ({
        ...d,
        teams: (d.teams ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createDepartment = async (values) => {
    const { error: err } = await supabase.from('pf_departments').insert(values)
    if (err) throw err
    await load()
  }

  const updateDepartment = async (id, values) => {
    const { error: err } = await supabase.from('pf_departments').update(values).eq('id', id)
    if (err) throw err
    await load()
  }

  const deleteDepartment = async (id) => {
    const { error: err } = await supabase.from('pf_departments').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  const createTeam = async (values) => {
    const { error: err } = await supabase.from('pf_teams').insert(values)
    if (err) throw err
    await load()
  }

  const updateTeam = async (id, values) => {
    const { error: err } = await supabase.from('pf_teams').update(values).eq('id', id)
    if (err) throw err
    await load()
  }

  const deleteTeam = async (id) => {
    const { error: err } = await supabase.from('pf_teams').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return {
    departments, loading, error, refetch: load,
    createDepartment, updateDepartment, deleteDepartment,
    createTeam, updateTeam, deleteTeam,
  }
}
