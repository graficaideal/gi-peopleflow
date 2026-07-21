// ponytail: sanity check for the peer-evaluator hard cap, no framework needed.
// Run with: node src/utils/evaluationAlgorithm.selfcheck.js
import assert from 'node:assert/strict'
import { selectPeerEvaluators } from './evaluationAlgorithm.js'

const dept = { area: 'producao' }
const employees = Array.from({ length: 6 }, (_, i) => ({
  id: `e${i}`,
  manager_id: null,
  team_id: 'team-1',
  department_id: 'dept-1',
  department: dept,
}))

const peerCounts = new Map()
for (const emp of employees) {
  const evaluators = selectPeerEvaluators(emp, employees, 2, peerCounts)
  assert.ok(evaluators.every(e => e.id !== emp.id), 'never picks self')
  assert.ok(evaluators.length <= 2, 'never exceeds requested limit')
}

// Hard cap: no evaluator id was ever counted more than once across the whole run.
for (const count of peerCounts.values()) {
  assert.equal(count, 1, 'each evaluator is assigned at most 1 peer evaluation')
}

// 6 employees * 2 slots = 12 demand, but only 6 possible evaluators (cap 1 each) ->
// pool exhausts and later employees get fewer than `limit` evaluators.
const totalAssigned = [...peerCounts.values()].reduce((a, b) => a + b, 0)
assert.equal(totalAssigned, employees.length, 'total assignments cannot exceed number of employees')

console.log('OK: peer evaluator hard cap holds')
