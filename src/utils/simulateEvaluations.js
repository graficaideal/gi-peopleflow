import { getTeamPool, selectPeerEvaluators } from './evaluationAlgorithm.js'

// Nível de fallback é reconstruído a posteriori (comparando avaliador vs. avaliado),
// em vez de alterar o contrato de selectPeerEvaluators — mantém o algoritmo intocado.
function classifyTier(evaluatee, evaluator) {
  if (evaluator.team_id != null && evaluator.team_id === evaluatee.team_id) return 'team'
  if (evaluator.department_id === evaluatee.department_id) return 'department'
  return 'relation'
}

// Só chamado quando selectPeerEvaluators devolveu 0 avaliadores para o colaborador.
function classifyNoPeerReason(employee, allEmployees) {
  const rawTeamMembers = allEmployees.filter(e => e.team_id === employee.team_id && e.id !== employee.id)
  const { hasTeam, teamPool } = getTeamPool(employee, allEmployees)
  if (hasTeam && rawTeamMembers.length === 0) return 'no_teammates'
  if (hasTeam && teamPool.length === 0) return 'all_manager_or_subordinate'
  return 'pool_exhausted'
}

export function buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 }) {
  const assignments = []
  const peerRows = []
  const noPeer = []
  const peerCounts = new Map()

  for (const emp of employees) {
    assignments.push({ evaluateeId: emp.id, evaluatorId: emp.id, type: 'self' })
    if (emp.manager_id) {
      assignments.push({ evaluateeId: emp.id, evaluatorId: emp.manager_id, type: 'manager' })
      assignments.push({ evaluateeId: emp.manager_id, evaluatorId: emp.id, type: 'subordinate' })
    }

    const peers = selectPeerEvaluators(emp, employees, peerLimit, peerCounts, relationLookup)
    if (peers.length === 0) {
      noPeer.push({ evaluatee: emp, reason: classifyNoPeerReason(emp, employees) })
    }
    for (const peer of peers) {
      assignments.push({ evaluateeId: emp.id, evaluatorId: peer.id, type: 'peer' })
      peerRows.push({ evaluatee: emp, evaluator: peer, tier: classifyTier(emp, peer) })
    }
  }

  if (evaluator0072) {
    for (const emp of employees) {
      if (emp.department?.area !== 'producao') continue
      if (emp.employee_number === '0072') continue
      if (emp.manager_id === evaluator0072.id) continue
      assignments.push({ evaluateeId: emp.id, evaluatorId: evaluator0072.id, type: 'general' })
    }
  }

  return { assignments, peerRows, noPeer }
}
