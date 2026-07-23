# Cycle Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins preview what activating a draft cycle would generate — evaluation counts by type, colaboradores left without a peer evaluator, and peer pairs that only formed via department/relationship fallback — with nothing written to the database, before committing to a real activation.

**Architecture:** The per-employee assignment loop that lives inside `generateEvaluationsForCycle` (self/manager/subordinate/peer/general) is extracted into a new pure function, `buildEvaluationPlan`, that returns in-memory assignments instead of DB records. `generateEvaluationsForCycle` becomes a thin wrapper: call `buildEvaluationPlan`, map its `assignments` to DB records (adding `cycle_id`/`token`/`token_expires_at`), upsert. The new `CycleSimulation` page calls the same pure function with freshly-fetched data and renders the result — summary cards, an alerts section, and a filterable table — without ever calling the DB-writing wrapper. Peer fallback tier (`team`/`department`/`relation`) and no-peer reason (`no_teammates`/`all_manager_or_subordinate`/`pool_exhausted`) are both computed by comparing plain fields on the employee records already in memory — no change to `selectPeerEvaluators`'s decision logic or return contract, only a small extracted helper (`getTeamPool`) so the reason-classifier doesn't duplicate eligibility rules.

**Tech Stack:** React 18, react-router-dom, Supabase (Postgres + supabase-js), plain `node` assert-based self-checks (no test framework is configured in this repo).

## Global Constraints

- No test suite/framework is configured (`CLAUDE.md`: "No test suite is configured. There is no `npm test`."). The established pattern for testing pure logic is a `*.selfcheck.js` file run via plain `node`, e.g. `node src/utils/evaluationAlgorithm.selfcheck.js`.
- `npm run lint` must pass with zero warnings before any commit.
- All UI strings are Portuguese (PT-PT), matching existing copy across `Cycles.jsx`/`Settings.jsx`.
- `src/components/ui/Modal.jsx`, `Table.jsx`, `Select.jsx`, and `Button.jsx` are all empty stub files (`// X - to be implemented`) — **do not import from them**. Every existing page (`Cycles.jsx`, `Settings.jsx`) instead defines its own scoped markup and CSS inline via a literal `<style>` tag in the component; this plan follows that same convention with a new `sim-` class prefix, so it doesn't collide with `cy-`/`st-` classes from other pages that might be mounted at the same time via `Layout`'s `<Outlet>`.
- Design reference: `docs/superpowers/specs/2026-07-23-cycle-simulation-design.md`. One correction versus that doc: the design says the peer table reuses `components/ui/Table.jsx`/`Select.jsx` — per the point above, those don't exist yet, so this plan builds plain `<table>`/`<select>` markup instead, styled inline like the rest of the app.

---

### Task 1: Extract `getTeamPool` in `evaluationAlgorithm.js`

**Files:**
- Modify: `src/utils/evaluationAlgorithm.js` (full file, currently 82 lines)
- Modify: `src/utils/evaluationAlgorithm.selfcheck.js` (full file, currently 105 lines)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function getTeamPool(employee, allEmployees)` returning `{ eligible, hasTeam, teamPool }` — `eligible` is every employee minus self/manager/direct-reports, `hasTeam` is `employee.team_id != null`, `teamPool` is `eligible` filtered to the same `team_id` (empty array when `hasTeam` is false). `selectPeerEvaluators(employee, allEmployees, limit, peerCounts, relationLookup)` keeps its exact existing signature and behavior — this task only changes what's inside it, not its contract. Task 2's `buildEvaluationPlan` will import and call `getTeamPool` directly.

- [ ] **Step 1: Add a failing self-check test for `getTeamPool`**

In `src/utils/evaluationAlgorithm.selfcheck.js`, change the import line (currently line 4):

```js
import { selectPeerEvaluators, getTeamPool } from './evaluationAlgorithm.js'
```

Then insert this new test block immediately before the final `console.log` (currently line 105), and update that `console.log` call as shown:

```js
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
```

(Remove the old `console.log('OK: peer evaluator hard cap, production carve-out, no-fallback rule, and relation-tier fallbacks all hold')` line — Test G's block replaces it with the updated one above.)

- [ ] **Step 2: Run the self-check to confirm it fails**

Run: `node src/utils/evaluationAlgorithm.selfcheck.js`
Expected: fails with `SyntaxError` or an import error, since `getTeamPool` is not yet exported from `evaluationAlgorithm.js`.

- [ ] **Step 3: Implement the extraction**

Replace the full contents of `src/utils/evaluationAlgorithm.js`:

```js
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

const EMPTY_LOOKUP = { teams: new Map(), departments: new Map() }

// Pool bruto de colegas de equipa elegíveis (exclui próprio, manager, subordinados
// diretos). Extraído para ser reutilizável fora da seleção de avaliadores — por
// exemplo para classificar o motivo de "sem par" numa simulação de ciclo.
export function getTeamPool(employee, allEmployees) {
  const eligible = allEmployees.filter(e =>
    e.id !== employee.id &&
    e.id !== employee.manager_id &&
    e.manager_id !== employee.id
  )
  const hasTeam = employee.team_id != null
  const teamPool = hasTeam ? eligible.filter(e => e.team_id === employee.team_id) : []
  return { eligible, hasTeam, teamPool }
}

// Escolhe um avaliador ainda disponível (0 avaliações peer atribuídas), alargando
// equipa → departamento (outra equipa) → relacionamentos (equipas ou departamentos)
// conforme necessário, com desempate aleatório.
// `teamPool` é o pool bruto da equipa (ignora o limite de 1); se a equipa da produção
// estiver esgotada só por limite, excede-o ali em vez de mudar de departamento.
function pickOneEvaluator(employee, available, teamPool, isProducao, peerCounts, relationLookup) {
  const sameTeamAvailable = employee.team_id
    ? available.filter(e => e.team_id === employee.team_id)
    : []
  if (sameTeamAvailable.length) return shuffle(sameTeamAvailable)[0]

  if (isProducao && teamPool.length) {
    return shuffle(teamPool).sort((a, b) => (peerCounts.get(a.id) ?? 0) - (peerCounts.get(b.id) ?? 0))[0]
  }

  // Tier 2: mesmo departamento, outra equipa (colaboradores sem equipa comparam
  // só por departamento, já que não há "outra equipa" a distinguir)
  const sameDeptOtherTeam = available.filter(e =>
    e.department_id === employee.department_id &&
    (employee.team_id == null || e.team_id !== employee.team_id)
  )
  if (sameDeptOtherTeam.length) return shuffle(sameDeptOtherTeam)[0]

  // Tier 3: equipas relacionadas (produção) ou departamentos relacionados (administrativo)
  const relatedIds = employee.team_id
    ? relationLookup.teams.get(employee.team_id)
    : relationLookup.departments.get(employee.department_id)
  if (relatedIds?.size) {
    const key = employee.team_id ? 'team_id' : 'department_id'
    const relatedAvailable = available.filter(e => relatedIds.has(e[key]))
    if (relatedAvailable.length) return shuffle(relatedAvailable)[0]
  }

  return null
}

// Cada avaliador só pode ser escolhido 1 vez em todo o ciclo (hard cap), por isso o pool
// exclui quem já tem uma avaliação peer atribuída. Se o pool se esgotar, o colaborador
// fica com menos avaliadores que `limit` em vez de reutilizar alguém já carregado
// (exceto na equipa de produção — ver `pickOneEvaluator`).
export function selectPeerEvaluators(employee, allEmployees, limit = 2, peerCounts = new Map(), relationLookup = EMPTY_LOOKUP) {
  const { eligible, hasTeam, teamPool } = getTeamPool(employee, allEmployees)

  // Responsável de turno/equipa cujos colegas são todos subordinados diretos: sem
  // colegas de equipa elegíveis, sem avaliação peer, sem fallback para departamento
  // ou relacionamentos. Colaboradores sem equipa (team_id null, ex: administrativa
  // sem equipas) não passam por este corte — avançam normalmente para os tiers
  // seguintes, e nunca são agrupados entre si só por ambos terem team_id null.
  if (hasTeam && !teamPool.length) return []

  const isProducao = employee.department?.area === 'producao'
  const base = eligible.filter(e => !(peerCounts.get(e.id) > 0))

  const selected = []
  const pickedIds = new Set()

  for (let i = 0; i < limit; i++) {
    const available = base.filter(e => !pickedIds.has(e.id))
    const remainingTeamPool = teamPool.filter(e => !pickedIds.has(e.id))
    const evaluator = pickOneEvaluator(employee, available, remainingTeamPool, isProducao, peerCounts, relationLookup)
    if (!evaluator) break

    pickedIds.add(evaluator.id)
    peerCounts.set(evaluator.id, (peerCounts.get(evaluator.id) ?? 0) + 1)
    selected.push(evaluator)
  }

  return selected
}
```

- [ ] **Step 4: Run the self-check to confirm everything passes**

Run: `node src/utils/evaluationAlgorithm.selfcheck.js`
Expected: `OK: peer evaluator hard cap, production carve-out, no-fallback rule, relation-tier fallbacks, and getTeamPool extraction all hold` (Tests A-F must still pass unchanged — this confirms the extraction didn't change `selectPeerEvaluators`'s behavior).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/utils/evaluationAlgorithm.js src/utils/evaluationAlgorithm.selfcheck.js
git commit -m "refactor: extract getTeamPool from selectPeerEvaluators for reuse in simulation"
```

---

### Task 2: `buildEvaluationPlan` in a new `simulateEvaluations.js`

**Files:**
- Create: `src/utils/simulateEvaluations.js`
- Create: `src/utils/simulateEvaluations.selfcheck.js`

**Interfaces:**
- Consumes: `getTeamPool`, `selectPeerEvaluators` from `src/utils/evaluationAlgorithm.js` (Task 1).
- Produces: `export function buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 })` returning:
  - `assignments: [{ evaluateeId, evaluatorId, type }]` — `type` is one of `'self' | 'manager' | 'subordinate' | 'peer' | 'general'`.
  - `peerRows: [{ evaluatee, evaluator, tier }]` — one entry per peer pair actually assigned; `evaluatee`/`evaluator` are the full employee objects (not just ids); `tier` is `'team' | 'department' | 'relation'`.
  - `noPeer: [{ evaluatee, reason }]` — one entry per employee who ended up with **zero** peer evaluators; `reason` is `'no_teammates' | 'all_manager_or_subordinate' | 'pool_exhausted'`.
  Task 3 (`generateEvaluations.js`) and Task 4 (`CycleSimulation.jsx`) both call this function.

- [ ] **Step 1: Write the failing self-check**

Create `src/utils/simulateEvaluations.selfcheck.js`:

```js
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
```

- [ ] **Step 2: Run the self-check to confirm it fails**

Run: `node src/utils/simulateEvaluations.selfcheck.js`
Expected: fails immediately — `src/utils/simulateEvaluations.js` doesn't exist yet, so the `import` throws `Cannot find module`.

- [ ] **Step 3: Implement `buildEvaluationPlan`**

Create `src/utils/simulateEvaluations.js`:

```js
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
```

- [ ] **Step 4: Run the self-check to confirm everything passes**

Run: `node src/utils/simulateEvaluations.selfcheck.js`
Expected: `OK: buildEvaluationPlan tier classification, no-peer reasons, and assignment counts all hold`

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/utils/simulateEvaluations.js src/utils/simulateEvaluations.selfcheck.js
git commit -m "feat: add buildEvaluationPlan pure function for cycle simulation"
```

---

### Task 3: Refactor `generateEvaluations.js` to consume `buildEvaluationPlan`

**Files:**
- Modify: `src/utils/generateEvaluations.js` (full file, currently 65 lines)

**Interfaces:**
- Consumes: `buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 })` from Task 2, `buildRelationLookup` from `src/utils/relationLookup.js` (unchanged).
- Produces: `generateEvaluationsForCycle(cycleId)` keeps its exact existing signature and DB behavior — this task changes only its internal implementation, not what it writes.

- [ ] **Step 1: Replace the implementation**

Replace the full contents of `src/utils/generateEvaluations.js`:

```js
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
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 3: Manual regression check (live Supabase)**

This function does live Supabase I/O with no automated test harness — the pure decision logic it delegates to is already covered by Task 1/2's self-checks; this step only verifies the DB-writing wrapper wasn't broken by the refactor.

Run: `npm run dev`

1. Go to Ciclos, create a new draft cycle (or use an existing one with no evaluations yet).
2. Click "Ativar" on that cycle.
3. Go to Avaliações and confirm evaluations exist for the cycle with the expected types (`self` for every active employee, `manager`/`subordinate` pairs where a manager is set, `peer` entries, `general` entries if an employee with `employee_number = '0072'` exists in a `producao` department).
4. This should look identical to activating a cycle before this refactor — if counts look off, stop and investigate before moving to Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/utils/generateEvaluations.js
git commit -m "refactor: build cycle evaluations via the shared buildEvaluationPlan function"
```

---

### Task 4: `CycleSimulation` page

**Files:**
- Create: `src/pages/CycleSimulation.jsx`

**Interfaces:**
- Consumes: `useCycles()` from `src/hooks/useCycles.js` (returns `{ cycles, loading, updateCycle }` among others — unchanged by this plan), `buildEvaluationPlan` from Task 2, `buildRelationLookup` from `src/utils/relationLookup.js`, `formatEvaluationType` from `src/utils/formatters.js`, `supabase` from `src/lib/supabaseClient.js`.
- Produces: default export `CycleSimulation` — a route-level page component reading `:id` from the URL via `useParams()`. No other file consumes this directly (Task 5 wires it into the router).

- [ ] **Step 1: Write the page**

Create `src/pages/CycleSimulation.jsx`:

```jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Play, AlertTriangle, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCycles } from '../hooks/useCycles'
import { buildEvaluationPlan } from '../utils/simulateEvaluations'
import { buildRelationLookup } from '../utils/relationLookup'
import { formatEvaluationType } from '../utils/formatters'

const TYPE_ORDER = ['self', 'peer', 'manager', 'general', 'subordinate']
const TIER_LABELS = { team: 'Equipa', department: 'Departamento', relation: 'Relacionamento' }
const REASON_LABELS = {
  no_teammates: 'Sem colegas de equipa',
  all_manager_or_subordinate: 'Só chefia/subordinados na equipa',
  pool_exhausted: 'Pool esgotado mesmo com fallback',
}

const groupLabel = (emp) => emp.team?.name ?? emp.department?.name ?? '—'

export default function CycleSimulation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cycles, loading: cyclesLoading, updateCycle } = useCycles()
  const cycle = cycles.find(c => c.id === id)

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)
  const [confirmActivate, setConfirmActivate] = useState(false)
  const [deptFilter, setDeptFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  const simulate = useCallback(async () => {
    setLoading(true)
    setError('')

    const [empResult, settingResult, evaluator0072Result, teamRelResult, deptRelResult] = await Promise.all([
      supabase.from('pf_employees').select(`
        id, employee_number, full_name, manager_id, department_id, team_id,
        department:pf_departments(name, area),
        team:pf_teams(name)
      `).eq('status', 'active'),
      supabase.from('pf_settings').select('value').eq('key', 'peer_evaluator_limit').single(),
      supabase.from('pf_employees').select('id').eq('employee_number', '0072').maybeSingle(),
      supabase.from('pf_team_relations').select('team_a_id, team_b_id'),
      supabase.from('pf_department_relations').select('department_a_id, department_b_id'),
    ])

    if (empResult.error) {
      setError(empResult.error.message)
      setLoading(false)
      return
    }

    const employees = empResult.data ?? []
    const peerLimit = parseInt(settingResult.data?.value ?? '2', 10)
    const evaluator0072 = evaluator0072Result.data ?? null
    const relationLookup = buildRelationLookup(teamRelResult.data, deptRelResult.data)

    setPlan(buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 }))
    setLoading(false)
  }, [])

  useEffect(() => { simulate() }, [simulate])

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(TYPE_ORDER.map(t => [t, 0]))
    for (const a of plan?.assignments ?? []) counts[a.type] = (counts[a.type] ?? 0) + 1
    return counts
  }, [plan])

  const noPeer = plan?.noPeer ?? []
  const fallbackRows = useMemo(() => (plan?.peerRows ?? []).filter(r => r.tier !== 'team'), [plan])
  const alertCount = noPeer.length + fallbackRows.length

  const tableRows = useMemo(() => {
    const rows = (plan?.peerRows ?? []).map(r => ({
      key: `${r.evaluatee.id}-${r.evaluator.id}`,
      evaluateeName: r.evaluatee.full_name,
      evaluateeDept: r.evaluatee.department?.name ?? '—',
      evaluateeTeam: groupLabel(r.evaluatee),
      evaluatorName: r.evaluator.full_name,
      evaluatorTeam: groupLabel(r.evaluator),
      tier: r.tier,
    }))
    for (const n of noPeer) {
      rows.push({
        key: `nopeer-${n.evaluatee.id}`,
        evaluateeName: n.evaluatee.full_name,
        evaluateeDept: n.evaluatee.department?.name ?? '—',
        evaluateeTeam: groupLabel(n.evaluatee),
        evaluatorName: '—',
        evaluatorTeam: '—',
        tier: 'none',
      })
    }
    return rows
  }, [plan, noPeer])

  const departmentOptions = useMemo(() =>
    [...new Set(tableRows.map(r => r.evaluateeDept))].sort(), [tableRows])

  const filteredRows = tableRows.filter(r =>
    (!deptFilter || r.evaluateeDept === deptFilter) &&
    (!tierFilter || r.tier === tierFilter)
  )

  const handleActivate = async () => {
    setActivating(true)
    setError('')
    try {
      await updateCycle(id, { status: 'active' })
      navigate('/cycles')
    } catch (err) {
      setError(err.message)
      setActivating(false)
    }
  }

  const requestActivate = () => {
    if (noPeer.length > 0) { setConfirmActivate(true); return }
    handleActivate()
  }

  const initialLoading = cyclesLoading || (loading && !plan)
  const notFound = !cyclesLoading && !cycle

  return (
    <>
      <style>{`
        .sim-back-row { margin-bottom: 14px; }
        .sim-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: var(--color-text-muted);
        }
        .sim-back:hover { color: var(--color-text); }

        .sim-header-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .sim-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

        .sim-btn {
          height: 34px; padding: 0 14px; border-radius: 7px;
          font-size: 13px; font-weight: 600; font-family: 'Outfit', sans-serif;
          cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px;
          transition: opacity 0.15s, background 0.15s;
        }
        .sim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sim-btn-primary { background: var(--color-accent); color: var(--color-primary); }
        .sim-btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .sim-btn-secondary {
          background: transparent; color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .sim-btn-secondary:hover:not(:disabled) { background: var(--color-hover); color: var(--color-text); }

        .sim-spin { animation: sim-spin 0.8s linear infinite; }
        @keyframes sim-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .sim-cards {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px; margin-bottom: 20px;
        }
        .sim-card {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 10px; padding: 14px 16px;
        }
        .sim-card-value { font-size: 22px; font-weight: 700; color: var(--color-text); }
        .sim-card-label { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
        .sim-card-warn { border-color: rgba(234,179,8,0.3); }
        .sim-card-warn .sim-card-value { color: #a16207; }
        .sim-card-alert { border-color: rgba(220,60,60,0.3); }
        .sim-card-alert .sim-card-value { color: #e05252; }

        .sim-error {
          font-size: 12px; color: #e05252; background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12); border-radius: 6px; padding: 7px 11px;
          margin-bottom: 16px;
        }

        .sim-alerts { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .sim-alert-group { border-radius: 10px; padding: 12px 14px; font-size: 12px; }
        .sim-alert-red { background: rgba(220,60,60,0.06); border: 1px solid rgba(220,60,60,0.16); }
        .sim-alert-yellow { background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2); }
        .sim-alert-title {
          display: flex; align-items: center; gap: 6px; font-weight: 600;
          margin-bottom: 8px; color: var(--color-text);
        }
        .sim-alert-row {
          display: flex; justify-content: space-between; gap: 10px;
          padding: 4px 0; color: var(--color-text-muted);
        }
        .sim-alert-reason { font-weight: 600; color: var(--color-text); white-space: nowrap; }

        .sim-table-filters { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .sim-input {
          height: 34px; padding: 0 10px; border: 1px solid var(--color-border);
          border-radius: 7px; background: var(--color-bg); color: var(--color-text);
          font-size: 12px; font-family: 'Outfit', sans-serif; cursor: pointer;
        }

        .sim-table-wrap {
          border: 1px solid var(--color-border); border-radius: 10px;
          overflow-x: auto; background: var(--color-surface);
        }
        .sim-table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
        .sim-table th {
          text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.4px; color: var(--color-text-muted);
          border-bottom: 1px solid var(--color-border);
        }
        .sim-table td {
          padding: 9px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text);
        }
        .sim-table tr:last-child td { border-bottom: none; }
        .sim-table-empty { text-align: center; color: var(--color-text-muted); padding: 24px !important; }

        .sim-skeleton {
          height: 240px; background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 12px;
        }
        .sim-empty { padding: 64px 24px; text-align: center; color: var(--color-text-muted); }

        .sim-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px;
        }
        .sim-modal {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 14px; width: 100%; max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.14);
        }
        .sim-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 0; font-size: 15px; font-weight: 600; color: var(--color-text);
        }
        .sim-modal-close {
          width: 28px; height: 28px; border-radius: 7px; display: flex;
          align-items: center; justify-content: center; color: var(--color-text-muted);
        }
        .sim-modal-close:hover { background: var(--color-hover); }
        .sim-modal-body { padding: 14px 20px 4px; font-size: 13px; color: var(--color-text); line-height: 1.6; }
        .sim-modal-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 16px 20px 20px; margin-top: 14px; border-top: 1px solid var(--color-border);
        }
      `}</style>

      <div>
        <div className="sim-back-row">
          <Link to="/cycles" className="sim-back"><ArrowLeft size={14} /> Ciclos</Link>
        </div>

        {initialLoading ? (
          <div className="sim-skeleton" />
        ) : notFound ? (
          <div className="sim-empty">
            <p>Ciclo não encontrado.</p>
          </div>
        ) : (
          <>
            <div className="sim-header-row">
              <h1 className="page-title">Simulação — {cycle.name}</h1>
              <div className="sim-header-actions">
                <button className="sim-btn sim-btn-secondary" onClick={simulate} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'sim-spin' : ''} /> Simular novamente
                </button>
                <button
                  className="sim-btn sim-btn-primary"
                  onClick={requestActivate}
                  disabled={activating || cycle.status !== 'draft'}
                  title={cycle.status !== 'draft' ? 'Este ciclo já não está em rascunho' : undefined}
                >
                  <Play size={14} /> {activating ? 'A ativar…' : 'Ativar Ciclo'}
                </button>
              </div>
            </div>

            {error && <p className="sim-error">{error}</p>}

            <div className="sim-cards">
              {TYPE_ORDER.map(type => (
                <div key={type} className="sim-card">
                  <div className="sim-card-value">{typeCounts[type]}</div>
                  <div className="sim-card-label">{formatEvaluationType(type)}</div>
                </div>
              ))}
              <div className="sim-card sim-card-warn">
                <div className="sim-card-value">{noPeer.length}</div>
                <div className="sim-card-label">Sem avaliação peer</div>
              </div>
              <div className="sim-card sim-card-warn">
                <div className="sim-card-value">{fallbackRows.length}</div>
                <div className="sim-card-label">Pares fora de equipa</div>
              </div>
              <div className="sim-card sim-card-alert">
                <div className="sim-card-value">{alertCount}</div>
                <div className="sim-card-label">Alertas</div>
              </div>
            </div>

            {alertCount > 0 && (
              <div className="sim-alerts">
                {noPeer.length > 0 && (
                  <div className="sim-alert-group sim-alert-red">
                    <div className="sim-alert-title"><AlertTriangle size={13} /> Sem avaliador peer ({noPeer.length})</div>
                    {noPeer.map(n => (
                      <div key={n.evaluatee.id} className="sim-alert-row">
                        <span>{n.evaluatee.full_name}</span>
                        <span className="sim-alert-reason">{REASON_LABELS[n.reason]}</span>
                      </div>
                    ))}
                  </div>
                )}
                {fallbackRows.length > 0 && (
                  <div className="sim-alert-group sim-alert-yellow">
                    <div className="sim-alert-title"><AlertTriangle size={13} /> Pares com fallback ({fallbackRows.length})</div>
                    {fallbackRows.map(r => (
                      <div key={`${r.evaluatee.id}-${r.evaluator.id}`} className="sim-alert-row">
                        <span>{r.evaluatee.full_name} ↔ {r.evaluator.full_name}</span>
                        <span className="sim-alert-reason">{TIER_LABELS[r.tier]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="sim-table-filters">
              <select className="sim-input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">Todos os departamentos</option>
                {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="sim-input" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                <option value="">Todos os níveis</option>
                <option value="team">Equipa</option>
                <option value="department">Departamento</option>
                <option value="relation">Relacionamento</option>
                <option value="none">Sem par</option>
              </select>
            </div>

            <div className="sim-table-wrap">
              <table className="sim-table">
                <thead>
                  <tr>
                    <th>Avaliado</th>
                    <th>Equipa</th>
                    <th>Avaliador</th>
                    <th>Equipa do Avaliador</th>
                    <th>Nível de fallback</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.key}>
                      <td>{r.evaluateeName}</td>
                      <td>{r.evaluateeTeam}</td>
                      <td>{r.evaluatorName}</td>
                      <td>{r.evaluatorTeam}</td>
                      <td>{r.tier === 'none' ? 'Sem par' : TIER_LABELS[r.tier]}</td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={5} className="sim-table-empty">Sem resultados para este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {confirmActivate && (
        <div className="sim-overlay" onClick={e => e.target === e.currentTarget && setConfirmActivate(false)}>
          <div className="sim-modal">
            <div className="sim-modal-header">
              <span>Ativar mesmo assim?</span>
              <button className="sim-modal-close" onClick={() => setConfirmActivate(false)}><X size={15} /></button>
            </div>
            <div className="sim-modal-body">
              <p>
                {noPeer.length} colaborador{noPeer.length !== 1 ? 'es' : ''} vai{noPeer.length !== 1 ? 'ão' : ''} ficar
                sem avaliação peer neste ciclo. Confirma que quer ativar mesmo assim?
              </p>
            </div>
            <div className="sim-modal-footer">
              <button className="sim-btn sim-btn-secondary" onClick={() => setConfirmActivate(false)}>Cancelar</button>
              <button
                className="sim-btn sim-btn-primary"
                onClick={() => { setConfirmActivate(false); handleActivate() }}
                disabled={activating}
              >
                {activating ? 'A ativar…' : 'Ativar mesmo assim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors or warnings. (The route isn't wired yet, so this only checks syntax/style — full behavioral verification happens in Task 5 once it's reachable.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/CycleSimulation.jsx
git commit -m "feat: add CycleSimulation page for dry-run cycle activation preview"
```

---

### Task 5: Wire the route and the "Simular" button

**Files:**
- Modify: `src/App.jsx` (full file, currently 54 lines)
- Modify: `src/components/cycles/CycleCard.jsx` (full file, currently 57 lines)

**Interfaces:**
- Consumes: `CycleSimulation` from Task 4.
- Produces: route `/cycles/:id/simulate`; `CycleCard` gains no new props (the new button is a plain navigation link, not a callback).

- [ ] **Step 1: Add the route**

In `src/App.jsx`, add the import (after the existing `import Cycles from './pages/Cycles'` on line 12):

```js
import CycleSimulation from './pages/CycleSimulation'
```

Then add the route immediately after `<Route path="cycles" element={<Cycles />} />` (currently line 43):

```jsx
              <Route path="cycles/:id/simulate" element={<CycleSimulation />} />
```

- [ ] **Step 2: Add the "Simular" button to `CycleCard`**

In `src/components/cycles/CycleCard.jsx`, replace the top two import lines (currently lines 1-2):

```js
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Play, Lock, Calendar, Eye, EyeOff, FlaskConical } from 'lucide-react'
```

Then, in the `cy-card-actions` block, add the new button immediately before the existing `isDraft` activate button (currently lines 36-40):

```jsx
            {isDraft && (
              <Link className="cy-action-btn" to={`/cycles/${cycle.id}/simulate`} title="Simular ciclo">
                <FlaskConical size={13} />
              </Link>
            )}
            {isDraft && (
              <button className="cy-action-btn cy-action-activate" onClick={() => onActivate(cycle)} title="Ativar ciclo">
                <Play size={13} />
              </button>
            )}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`

1. Navigate to Ciclos. Confirm a draft cycle's card shows a new flask icon button alongside the existing Play/Edit/Delete icons, and that active/closed cycles do **not** show it.
2. Click it. Confirm it navigates to `/cycles/<id>/simulate` and the page loads: summary cards, alerts (if any colaboradores lack a peer or a fallback tier fired), and the peer distribution table.
3. Test both table filters (department, fallback level) — confirm rows narrow correctly and the "Sem resultados para este filtro" message appears when a combination matches nothing.
4. Click "Simular novamente" — confirm the button disables briefly and the table refreshes.
5. If any colaborador shows up in "Sem avaliador peer": click "Ativar Ciclo" and confirm the confirmation modal appears with the correct count; cancel it, then click "Ativar Ciclo" again and confirm through the modal — confirm you land back on `/cycles` with the cycle now `Ativo`.
6. If no colaborador is missing a peer for the cycle you test with: click "Ativar Ciclo" and confirm it activates directly (no modal) and navigates to `/cycles`.
7. Go to Avaliações and spot-check that the generated evaluations match what the simulation predicted (same type counts, same peer pairs).
8. Navigate directly to `/cycles/<id>/simulate` for a cycle that is `active` or `closed` (edit the URL by hand) — confirm the simulation still renders but "Ativar Ciclo" is disabled with a tooltip explaining why.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/cycles/CycleCard.jsx
git commit -m "feat: wire up cycle simulation route and Simular button"
```
