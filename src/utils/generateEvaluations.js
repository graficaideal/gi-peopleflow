import { supabase } from '../lib/supabaseClient'
import { buildEvaluationPlan } from './simulateEvaluations'
import { buildRelationLookup } from './relationLookup'

export { buildRelationLookup }

export async function generateEvaluationsForCycle(cycleId) {
  const [empResult, settingResult, evaluator0072Result, cycleResult, teamRelResult, deptRelResult] = await Promise.all([
    supabase.from('pf_employees').select('id, employee_number, manager_id, team_id, department_id, department:pf_departments(area)').eq('status', 'active'),
    supabase.from('pf_settings').select('value').eq('key', 'peer_evaluator_limit').single(),
    supabase.from('pf_employees').select('id').eq('employee_number', '0072').maybeSingle(),
    supabase.from('pf_evaluation_cycles').select('end_date').eq('id', cycleId).single(),
    supabase.from('pf_team_relations').select('team_a_id, team_b_id'),
    supabase.from('pf_department_relations').select('department_a_id, department_b_id'),
  ])

  const employees = empResult.data ?? []
  if (!employees.length) return

  const peerLimit = parseInt(settingResult.data?.value ?? '2', 10)
  const evaluator0072 = evaluator0072Result.data ?? null
  const endDate = cycleResult.data?.end_date ?? null
  const tokenExpiresAt = endDate ? new Date(endDate + 'T23:59:59').toISOString() : null
  const relationLookup = buildRelationLookup(teamRelResult.data, deptRelResult.data)

  const { assignments } = buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 })
  if (!assignments.length) return

  const records = assignments.map(({ evaluateeId, evaluatorId, type }) => ({
    cycle_id: cycleId,
    evaluatee_id: evaluateeId,
    evaluator_id: evaluatorId,
    type,
    status: 'pending',
    token: crypto.randomUUID(),
    token_expires_at: tokenExpiresAt,
  }))

  const { error } = await supabase
    .from('pf_evaluations')
    .upsert(records, { onConflict: 'cycle_id,evaluatee_id,evaluator_id,type', ignoreDuplicates: true })
  if (error) throw error
}
