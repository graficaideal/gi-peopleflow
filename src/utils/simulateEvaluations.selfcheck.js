// ponytail: sanity check for buildEvaluationPlan's tier/reason classification,
// no framework needed. Run with: node src/utils/simulateEvaluations.selfcheck.js
import assert from 'node:assert/strict'
import { buildEvaluationPlan } from './simulateEvaluations.js'

const admin = { area: 'administrativa' }
const producao = { area: 'producao' }
const EMPTY_LOOKUP = { teams: new Map(), departments: new Map() }

// --- Test H: same-department-other-team fallback is tagged 'department' -----------
{
  const e1 = { id: 'e1', manager_id: null, team_id: 'team-A', department_id: 'dept-1', department: admin }
  const e2 = { id: 'e2', manager_id: null, team_id: 'team-A', department_id: 'dept-1', department: admin }
  const e3 = { id: 'e3', manager_id: null, team_id: 'team-B', department_id: 'dept-1', department: admin }
  const e4 = { id: 'e4', manager_id: null, team_id: 'team-B', department_id: 'dept-1', department: admin }
  const employees = [e1, e2, e3, e4]

  const { peerRows } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup: EMPTY_LOOKUP, evaluator0072: null })
  const e1Rows = peerRows.filter(r => r.evaluatee.id === 'e1')
  assert.equal(e1Rows.length, 2, 'H: e1 gets 2 peer rows (team + department fallback)')
  assert.equal(e1Rows[0].tier, 'team', 'H: first peer row is same-team tier')
  assert.equal(e1Rows[1].tier, 'department', 'H: second peer row is same-department-other-team tier')
}

// --- Test I: related-team fallback is tagged 'relation' ---------------------------
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

  const { peerRows } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup, evaluator0072: null })
  const p1Rows = peerRows.filter(r => r.evaluatee.id === 'p1')
  assert.equal(p1Rows.length, 2, 'I: p1 gets 2 peer rows (team + relation fallback)')
  assert.equal(p1Rows[1].tier, 'relation', 'I: second peer row is relation-tier')
  assert.equal(p1Rows[1].evaluator.id, 'p4', 'I: relation-tier picks the related team p4, never unrelated p3')
}

// --- Test J: team-lead-with-only-subordinates hard stop -> 'all_manager_or_subordinate'
{
  const lead = { id: 'lead', manager_id: null, team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const sub1 = { id: 'sub1', manager_id: 'lead', team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const sub2 = { id: 'sub2', manager_id: 'lead', team_id: 'lead-team', department_id: 'dept-1', department: admin }
  const other1 = { id: 'other1', manager_id: null, team_id: 'other-team', department_id: 'dept-1', department: admin }
  const other2 = { id: 'other2', manager_id: null, team_id: 'other-team', department_id: 'dept-1', department: admin }
  const employees = [lead, sub1, sub2, other1, other2]

  const { noPeer } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup: EMPTY_LOOKUP, evaluator0072: null })
  const leadEntry = noPeer.find(n => n.evaluatee.id === 'lead')
  assert.ok(leadEntry, 'J: lead has no peer evaluators, so appears in noPeer')
  assert.equal(leadEntry.reason, 'all_manager_or_subordinate', 'J: reason is that the whole team is direct reports')
}

// --- Test K: employee alone in their team -> 'no_teammates' ------------------------
{
  const solo = { id: 'solo', manager_id: null, team_id: 'solo-team', department_id: 'dept-1', department: admin }
  const other = { id: 'other', manager_id: null, team_id: 'other-team', department_id: 'dept-1', department: admin }
  const employees = [solo, other]

  const { noPeer } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup: EMPTY_LOOKUP, evaluator0072: null })
  const soloEntry = noPeer.find(n => n.evaluatee.id === 'solo')
  assert.ok(soloEntry, 'K: solo has no teammates, so appears in noPeer')
  assert.equal(soloEntry.reason, 'no_teammates', 'K: reason is no teammates at all in the team')
}

// --- Test L: employee with no team and no fallback anywhere -> 'pool_exhausted' ----
{
  const a1 = { id: 'a1', manager_id: null, team_id: null, department_id: 'dept-X', department: admin }
  const employees = [a1]

  const { noPeer } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup: EMPTY_LOOKUP, evaluator0072: null })
  const entry = noPeer.find(n => n.evaluatee.id === 'a1')
  assert.ok(entry, 'L: a1 is alone in the whole organisation, no peer possible')
  assert.equal(entry.reason, 'pool_exhausted', 'L: reason is pool exhausted (hasTeam is false, so no team-shaped reason applies)')
}

// --- Test M: assignments carry one self/manager/subordinate entry each ------------
{
  const mgr = { id: 'mgr', manager_id: null, team_id: 'team-1', department_id: 'dept-1', department: admin }
  const emp1 = { id: 'emp1', manager_id: 'mgr', team_id: 'team-1', department_id: 'dept-1', department: admin }
  const emp2 = { id: 'emp2', manager_id: 'mgr', team_id: 'team-1', department_id: 'dept-1', department: admin }
  const employees = [mgr, emp1, emp2]

  const { assignments } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup: EMPTY_LOOKUP, evaluator0072: null })
  const byType = t => assignments.filter(a => a.type === t)
  assert.equal(byType('self').length, 3, 'M: one self-assignment per employee')
  assert.equal(byType('manager').length, 2, 'M: one manager-assignment per employee with a manager')
  assert.equal(byType('subordinate').length, 2, 'M: one subordinate-assignment per employee with a manager')
}

// --- Test N: general assignment only targets producao-area employees --------------
{
  const evaluator0072 = { id: 'ev72', employee_number: '0072' }
  const producaoEmp = { id: 'pe1', employee_number: '1001', manager_id: null, team_id: null, department_id: 'dept-P', department: producao }
  const adminEmp = { id: 'ae1', employee_number: '1002', manager_id: null, team_id: null, department_id: 'dept-A', department: admin }
  const employees = [producaoEmp, adminEmp]

  const { assignments } = buildEvaluationPlan({ employees, peerLimit: 2, relationLookup: EMPTY_LOOKUP, evaluator0072 })
  const generalAssignments = assignments.filter(a => a.type === 'general')
  assert.equal(generalAssignments.length, 1, 'N: only producao-area employees get a general assignment')
  assert.equal(generalAssignments[0].evaluateeId, 'pe1', 'N: general assignment targets the producao employee')
  assert.equal(generalAssignments[0].evaluatorId, 'ev72', 'N: general assignment evaluator is evaluator0072')
}

console.log('OK: buildEvaluationPlan tier classification, no-peer reasons, and assignment counts all hold')
