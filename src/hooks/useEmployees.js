import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useEmployees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pf_employees')
      .select(`
        id, employee_number, full_name, role, email, status,
        department_id, team_id, manager_id, job_category_id,
        department:pf_departments(id, name),
        team:pf_teams(id, name),
        manager:pf_employees!pf_employees_manager_id_fkey(id, full_name, employee_number),
        job_category:pf_job_categories(id, name)
      `)
      .order('full_name')
    if (err) { setError(err.message); setLoading(false); return }
    setEmployees(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createEmployee = async (values) => {
    const { error: err } = await supabase.from('pf_employees').insert(values)
    if (err) throw err
    await load()
  }

  const updateEmployee = async (id, values) => {
    const { error: err } = await supabase.from('pf_employees').update(values).eq('id', id)
    if (err) throw err
    await load()
  }

  const deleteEmployee = async (id) => {
    const { error: err } = await supabase.from('pf_employees').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { employees, loading, error, refetch: load, createEmployee, updateEmployee, deleteEmployee }
}
