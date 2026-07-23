// ponytail: sanity check for the peer-evaluator hard cap and its carve-outs,
// no framework needed. Run with: node src/utils/evaluationAlgorithm.selfcheck.js
import assert from 'node:assert/strict'
import { selectPeerEvaluators, getTeamPool } from './evaluationAlgorithm.js'

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

// --- Test D: tier 2 fires once the (small) team pool is exhausted -----------------
{
  const e1 = { id: 'e1', manager_id: null, team_id: 'team-A', department_id: 'dept-1', department: admin }
  const e2 = { id: 'e2', manager_id: null, team_id: 'team-A', department_id: 'dept-1', department: admin }
  const e3 = { id: 'e3', manager_id: null, team_id: 'team-B', department_id: 'dept-1', department: admin }
  const e4 = { id: 'e4', manager_id: null, team_id: 'team-B', department_id: 'dept-1', department: admin }
  const employees = [e1, e2, e3, e4]

  const evaluators = selectPeerEvaluators(e1, employees, 2, new Map())
  assert.equal(evaluators.length, 2, 'D: widens to same department, other team once team-A (1 teammate) runs out')
  assert.equal(evaluators[0].id, 'e2', 'D: tier 1 (same team) picked first')
  assert.ok(['e3', 'e4'].includes(evaluators[1].id), 'D: tier 2 (same department, other team) picked second')
}

// --- Test E: tier 3 fires for related teams (production), never for unrelated ones -
{
  const p1 = { id: 'p1', manager_id: null, team_id: 'team-P1', department_id: 'dept-P', department: producao }
  const p2 = { id: 'p2', manager_id: null, team_id: 'team-P1', department_id: 'dept-P', department: producao }
  const p3 = { id: 'p3', manager_id: null, team_id: 'team-P2', department_id: 'dept-Q', department: producao }
  const p4 = { id: 'p4', manager_id: null, team_id: 'team-P3', department_id: 'dept-R', department: producao }
  const employees = [p1, p2, p3, p4]
  const relationLookup = {
    teams: new Map([['team-P1', new Set(['team-P3'])], ['team-P3', new Set(['team-P1'])]]),
    departments: new Map(),
  }

  const evaluators = selectPeerEvaluators(p1, employees, 2, new Map(), relationLookup)
  assert.equal(evaluators.length, 2, 'E: fills the limit via tier 3 once team and department tiers run out')
  assert.equal(evaluators[0].id, 'p2', 'E: tier 1 (same team) picked first')
  assert.equal(evaluators[1].id, 'p4', 'E: tier 3 picks the related team (p4), never the unrelated one (p3)')
}

// --- Test F: tier 3 fires for related departments (admin), and NULL team_id never --
// --- pools across unrelated departments -------------------------------------------
{
  const a1 = { id: 'a1', manager_id: null, team_id: null, department_id: 'dept-X', department: admin }
  const a2 = { id: 'a2', manager_id: null, team_id: null, department_id: 'dept-Y', department: admin }
  const a3 = { id: 'a3', manager_id: null, team_id: null, department_id: 'dept-Z', department: admin }
  const employees = [a1, a2, a3]
  const relationLookup = {
    teams: new Map(),
    departments: new Map([['dept-X', new Set(['dept-Z'])], ['dept-Z', new Set(['dept-X'])]]),
  }

  const evaluators = selectPeerEvaluators(a1, employees, 2, new Map(), relationLookup)
  assert.equal(evaluators.length, 1, 'F: only the related department (dept-Z) contributes an evaluator')
  assert.equal(evaluators[0].id, 'a3', 'F: picks a3 (related dept-Z), never a2 (unrelated dept-Y)')
}

// --- Test G: getTeamPool exposes eligible/hasTeam/teamPool for reason classification ---
{
  const lead = { id: 'lead', manager_id: null, team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const sub1 = { id: 'sub1', manager_id: 'lead', team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const solo = { id: 'solo', manager_id: null, team_id: 'solo-team', department_id: 'dept-1', department: admin }
  const employees = [lead, sub1, solo]

  const leadPool = getTeamPool(lead, employees)
  assert.equal(leadPool.hasTeam, true, 'G: lead has a team_id')
  assert.equal(leadPool.teamPool.length, 0, "G: lead's only teammate is a direct report, excluded from teamPool")
  assert.ok(leadPool.eligible.some(e => e.id === 'solo'), 'G: eligible still includes employees outside the team')

  const soloPool = getTeamPool(solo, employees)
  assert.equal(soloPool.hasTeam, true, 'G: solo has its own team_id')
  assert.equal(soloPool.teamPool.length, 0, 'G: solo has no teammates at all in its team')

  const noTeam = { id: 'nt', manager_id: null, team_id: null, department_id: 'dept-1', department: admin }
  const ntPool = getTeamPool(noTeam, employees)
  assert.equal(ntPool.hasTeam, false, 'G: null team_id means hasTeam is false')
  assert.equal(ntPool.teamPool.length, 0, 'G: hasTeam false always yields an empty teamPool')
}

console.log('OK: peer evaluator hard cap, production carve-out, no-fallback rule, relation-tier fallbacks, and getTeamPool extraction all hold')
