// ponytail: sanity check for the peer-evaluator hard cap and its two carve-outs,
// no framework needed. Run with: node src/utils/evaluationAlgorithm.selfcheck.js
import assert from 'node:assert/strict'
import { selectPeerEvaluators } from './evaluationAlgorithm.js'

const admin = { area: 'administrativa' }
const producao = { area: 'producao' }

// --- Test A: non-production hard cap holds strictly, shortfall accepted -----------
{
  const employees = Array.from({ length: 4 }, (_, i) => ({
    id: `a${i}`, manager_id: null, team_id: 'team-1', department_id: 'dept-1', department: admin,
  }))
  const peerCounts = new Map()
  for (const emp of employees) {
    const evaluators = selectPeerEvaluators(emp, employees, 2, peerCounts)
    assert.ok(evaluators.every(e => e.id !== emp.id), 'A: never picks self')
    assert.ok(evaluators.length <= 2, 'A: never exceeds requested limit')
  }
  for (const count of peerCounts.values()) {
    assert.equal(count, 1, 'A: non-production never exceeds the 1-assignment cap')
  }
  const total = [...peerCounts.values()].reduce((a, b) => a + b, 0)
  assert.equal(total, employees.length, 'A: pool exhausts, later employees get fewer evaluators')
}

// --- Test B: production exceeds the cap within the team instead of shorting -------
{
  const employees = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`, manager_id: null, team_id: 'team-1', department_id: 'dept-1', department: producao,
  }))
  const peerCounts = new Map()
  for (const emp of employees) {
    const evaluators = selectPeerEvaluators(emp, employees, 2, peerCounts)
    assert.ok(evaluators.every(e => e.id !== emp.id), 'B: never picks self')
    assert.equal(evaluators.length, 2, 'B: production always fills the requested limit')
    assert.equal(new Set(evaluators.map(e => e.id)).size, evaluators.length, 'B: no duplicate evaluator for the same evaluatee')
  }
  const total = [...peerCounts.values()].reduce((a, b) => a + b, 0)
  assert.equal(total, employees.length * 2, 'B: cap is exceeded so demand is fully met')
}

// --- Test C: team lead whose whole team is direct reports gets no fallback --------
{
  const lead = { id: 'lead', manager_id: null, team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const sub1 = { id: 'sub1', manager_id: 'lead', team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const sub2 = { id: 'sub2', manager_id: 'lead', team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const other1 = { id: 'other1', manager_id: null, team_id: 'other-team', department_id: 'dept-1', department: admin }
  const other2 = { id: 'other2', manager_id: null, team_id: 'other-team', department_id: 'dept-1', department: admin }
  const employees = [lead, sub1, sub2, other1, other2]

  const evaluators = selectPeerEvaluators(lead, employees, 2, new Map())
  assert.equal(evaluators.length, 0, 'C: no peer evaluators, no fallback to department when team is all subordinates')
}

console.log('OK: peer evaluator hard cap, production carve-out and no-fallback rule all hold')
