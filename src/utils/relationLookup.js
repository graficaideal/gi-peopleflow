// ponytail: pure logic split out of generateEvaluations.js so it can be
// imported (and self-checked with plain `node`) without pulling in the
// Supabase client, which throws at import time without env vars.
export function buildRelationLookup(teamRows, departmentRows) {
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
