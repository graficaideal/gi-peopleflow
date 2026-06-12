import { supabase } from '../lib/supabaseClient'
import { selectPeerEvaluators } from './evaluationAlgorithm'

export async function generateEvaluationsForCycle(cycleId) {
  const [empResult, settingResult, evaluator0072Result] = await Promise.all([
    supabase.from('pf_employees').select('id, employee_number, manager_id, team_id, department_id, department:pf_departments(area)').eq('status', 'active'),
    supabase.from('pf_settings').select('value').eq('key', 'peer_evaluator_limit').single(),
    supabase.from('pf_employees').select('id').eq('employee_number', '0072').maybeSingle(),
  ])

  const employees = empResult.data ?? []
  if (!employees.length) return

  const peerLimit = parseInt(settingResult.data?.value ?? '2', 10)
  const evaluator0072 = evaluator0072Result.data ?? null
  const records = []

  for (const emp of employees) {
    records.push({ cycle_id: cycleId, evaluatee_id: emp.id, evaluator_id: emp.id, type: 'self', status: 'pending' })

    if (emp.manager_id) {
      records.push({ cycle_id: cycleId, evaluatee_id: emp.id, evaluator_id: emp.manager_id, type: 'manager', status: 'pending' })
    }

    for (const peer of selectPeerEvaluators(emp, employees, peerLimit)) {
      records.push({ cycle_id: cycleId, evaluatee_id: emp.id, evaluator_id: peer.id, type: 'peer', status: 'pending' })
    }
  }

  if (evaluator0072) {
    for (const emp of employees) {
      if (emp.department?.area !== 'producao') continue
      if (emp.employee_number === '0072') continue
      if (emp.manager_id === evaluator0072.id) continue
      records.push({ cycle_id: cycleId, evaluatee_id: emp.id, evaluator_id: evaluator0072.id, type: 'general', status: 'pending' })
    }
  }

  if (!records.length) return

  const { error } = await supabase
    .from('pf_evaluations')
    .upsert(records, { onConflict: 'cycle_id,evaluatee_id,evaluator_id,type', ignoreDuplicates: true })
  if (error) throw error
}
