import { supabase } from '../lib/supabaseClient'
import { selectPeerEvaluators } from './evaluationAlgorithm'

function buildRelationLookup(teamRows, departmentRows) {
  const teams = new Map()
  for (const { team_a_id, team_b_id } of teamRows ?? []) {
    if (!teams.has(team_a_id)) teams.set(team_a_id, new Set())
    if (!teams.has(team_b_id)) teams.set(team_b_id, new Set())
    teams.get(team_a_id).add(team_b_id)
    teams.get(team_b_id).add(team_a_id)
  }

  const departments = new Map()
  for (const { department_a_id, department_b_id } of departmentRows ?? []) {
    if (!departments.has(department_a_id)) departments.set(department_a_id, new Set())
    if (!departments.has(department_b_id)) departments.set(department_b_id, new Set())
    departments.get(department_a_id).add(department_b_id)
    departments.get(department_b_id).add(department_a_id)
  }

  return { teams, departments }
}

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
      records.push(makeRecord(emp.manager_id, emp.id, 'subordinate'))
    }
    for (const peer of selectPeerEvaluators(emp, employees, peerLimit, peerCounts, relationLookup)) {
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
