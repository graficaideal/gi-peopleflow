// ponytail: sanity check for buildRelationLookup's bidirectional expansion,
// no framework needed. Run with: node src/utils/generateEvaluations.selfcheck.js
//
// Imports from relationLookup.js (not generateEvaluations.js) on purpose:
// generateEvaluations.js pulls in the Supabase client at module scope, which
// throws at import time without real env vars. buildRelationLookup itself is
// pure, lives in relationLookup.js, and is re-exported from
// generateEvaluations.js for callers — this check exercises the same function.
import assert from 'node:assert/strict'
import { buildRelationLookup } from './relationLookup.js'

// --- Test A: one team row expands to both directions ------------------------------
{
  const { teams } = buildRelationLookup([{ team_a_id: 'X', team_b_id: 'Y' }], [])
  assert.ok(teams.get('X').has('Y'), 'A: X -> Y')
  assert.ok(teams.get('Y').has('X'), 'A: Y -> X')
}

// --- Test B: one department row expands to both directions ------------------------
{
  const { departments } = buildRelationLookup([], [{ department_a_id: 'X', department_b_id: 'Y' }])
  assert.ok(departments.get('X').has('Y'), 'B: X -> Y')
  assert.ok(departments.get('Y').has('X'), 'B: Y -> X')
}

// --- Test C: entity with no relation rows is absent from the map, not an empty Set -
{
  const { teams } = buildRelationLookup([{ team_a_id: 'X', team_b_id: 'Y' }], [])
  assert.equal(teams.get('Z'), undefined, 'C: unrelated id has no map entry at all')
}

// --- Test D: undefined/null/[] arguments don't throw and yield empty maps ---------
{
  const r1 = buildRelationLookup(undefined, undefined)
  assert.equal(r1.teams.size, 0, 'D: undefined teamRows -> empty map')
  assert.equal(r1.departments.size, 0, 'D: undefined departmentRows -> empty map')

  const r2 = buildRelationLookup(null, null)
  assert.equal(r2.teams.size, 0, 'D: null teamRows -> empty map')
  assert.equal(r2.departments.size, 0, 'D: null departmentRows -> empty map')

  const r3 = buildRelationLookup([], [])
  assert.equal(r3.teams.size, 0, 'D: [] teamRows -> empty map')
  assert.equal(r3.departments.size, 0, 'D: [] departmentRows -> empty map')
}

// --- Test E: independent relation rows don't cross-contaminate (no transitivity) --
{
  const { teams } = buildRelationLookup(
    [{ team_a_id: 'X', team_b_id: 'Y' }, { team_a_id: 'Y', team_b_id: 'Z' }],
    [],
  )
  assert.ok(!teams.get('X').has('Z'), 'E: X-Y and Y-Z do not imply X-Z')
  assert.ok(teams.get('Y').has('X'), 'E: Y still relates to X directly')
  assert.ok(teams.get('Y').has('Z'), 'E: Y still relates to Z directly')
}

console.log('OK: buildRelationLookup bidirectional expansion, absence-not-empty-set, guard clauses, and no-transitivity all hold')
