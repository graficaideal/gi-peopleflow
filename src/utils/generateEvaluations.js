import { supabase } from '../lib/supabaseClient'
import { selectPeerEvaluators } from './evaluationAlgorithm'

export async function generateEvaluationsForCycle(cycleId) {
  const [empResult, settingResult, evaluator0072Result, cycleResult] = await Promise.all([
    supabase.from('pf_employees').select('id, employee_number, manager_id, team_id, department_id, department:pf_departments(area)').eq('status', 'active'),
    supabase.from('pf_settings').select('value').eq('key', 'peer_evaluator_limit').single(),
    supabase.from('pf_employees').select('id').eq('employee_number', '0072').maybeSingle(),
    supabase.from('pf_evaluation_cycles').select('end_date').eq('id', cycleId).single(),
  ])

  const employees = empResult.data ?? []
  if (!employees.length) return

  const peerLimit = parseInt(settingResult.data?.value ?? '2', 10)
  const evaluator0072 = evaluator0072Result.data ?? null
  const endDate = cycleResult.data?.end_date ?? null
  const tokenExpiresAt = endDate ? new Date(endDate + 'T23:59:59').toISOString() : null

  const makeRecord = (evaluateeId, evaluatorId, type) => ({
    cycle_id: cycleId,
    evaluatee_id: evaluateeId,
    evaluator_id: evaluatorId,
    type,
    status: 'pending',
    token: crypto.randomUUID(),
    token_expires_at: tokenExpiresAt,
  })

  const records = []
  const peerCounts = new Map()

  for (const emp of employees) {
    records.push(makeRecord(emp.id, emp.id, 'self'))
    if (emp.manager_id) {
      records.push(makeRecord(emp.id, emp.manager_id, 'manager'))
    }
    for (const peer of selectPeerEvaluators(emp, employees, peerLimit, peerCounts)) {
      records.push(makeRecord(emp.id, peer.id, 'peer'))
    }
  }

  if (evaluator0072) {
    for (const emp of employees) {
      if (emp.department?.area !== 'producao') continue
      if (emp.employee_number === '0072') continue
      if (emp.manager_id === evaluator0072.id) continue
      records.push(makeRecord(emp.id, evaluator0072.id, 'general'))
    }
  }

  if (!records.length) return

  const { error } = await supabase
    .from('pf_evaluations')
    .upsert(records, { onConflict: 'cycle_id,evaluatee_id,evaluator_id,type', ignoreDuplicates: true })
  if (error) throw error
}
