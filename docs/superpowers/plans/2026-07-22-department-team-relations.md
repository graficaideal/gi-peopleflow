# Department/Team Relations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins configure bidirectional relationships between departments (administrative area, no teams) and between teams (production area, has teams) in Settings, and use those relationships as a new fallback tier when picking peer evaluators.

**Architecture:** Two new junction tables store the relationships with a canonical-order constraint so `A↔B` is always a single row. The peer-selection algorithm (`selectPeerEvaluators`) gains a precomputed `relationLookup` parameter (two `Map<id, Set<id>>`), built once per cycle by the caller, consulted only after same-team and same-department-other-team pools are exhausted. A single reusable `RelationsPanel` component renders both the department and team management UIs inside a new Settings tab.

**Tech Stack:** React 18, Supabase (Postgres + supabase-js), plain `node` assert-based self-check (no test framework is configured in this repo).

## Global Constraints

- No test suite/framework is configured (`CLAUDE.md`: "No test suite is configured. There is no `npm test`."). The established pattern for testing pure logic is `src/utils/evaluationAlgorithm.selfcheck.js`, run via `node src/utils/evaluationAlgorithm.selfcheck.js`.
- `npm run lint` must pass with zero warnings before any commit.
- All UI strings are Portuguese (PT-PT), matching existing copy in `Settings.jsx`/`CriteriaSettings.jsx`.
- Migrations live in `supabase/migrations/` and are applied manually via the Supabase dashboard SQL editor — there is no local Postgres or migration runner in this repo.
- Design reference: `docs/superpowers/specs/2026-07-22-department-team-relations-design.md`.

---

### Task 1: Migration — relation tables

**Files:**
- Create: `supabase/migrations/012_relations.sql`

**Interfaces:**
- Produces: tables `pf_department_relations(id, department_a_id, department_b_id, created_at)` and `pf_team_relations(id, team_a_id, team_b_id, created_at)`, each with `UNIQUE(a_id, b_id)` and `CHECK(a_id < b_id)`.

- [ ] **Step 1: Write the migration file**

```sql
-- Relationships between departments (administrative area, no teams) and
-- between teams (production area). Both are bidirectional: a single row
-- represents A<->B, enforced via canonical ordering (a_id < b_id) so the
-- app never has to worry about which order the user picked the pair in.
-- No RLS: matches pf_departments/pf_teams, neither of which has RLS enabled.

CREATE TABLE pf_department_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_a_id UUID NOT NULL REFERENCES pf_departments(id) ON DELETE CASCADE,
  department_b_id UUID NOT NULL REFERENCES pf_departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (department_a_id < department_b_id),
  UNIQUE (department_a_id, department_b_id)
);

CREATE TABLE pf_team_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id UUID NOT NULL REFERENCES pf_teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES pf_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (team_a_id < team_b_id),
  UNIQUE (team_a_id, team_b_id)
);
```

- [ ] **Step 2: Apply the migration**

This project has no local Postgres — run the SQL above in the Supabase dashboard SQL editor (the same workflow used for every prior migration in `supabase/migrations/`). Confirm both tables appear under Table Editor before moving on; Tasks 3 and 5's manual verification steps depend on these tables existing.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_relations.sql
git commit -m "feat: add pf_department_relations and pf_team_relations tables"
```

---

### Task 2: Algorithm — pool hierarchy update (TDD via self-check script)

**Files:**
- Modify: `src/utils/evaluationAlgorithm.js` (full file, currently 63 lines)
- Modify: `src/utils/evaluationAlgorithm.selfcheck.js` (full file, currently 57 lines)

**Interfaces:**
- Consumes: nothing new — pure functions, no external dependency.
- Produces: `selectPeerEvaluators(employee, allEmployees, limit = 2, peerCounts = new Map(), relationLookup = { teams: new Map(), departments: new Map() })` — same name, two new tiers added, plus a `relationLookup` param that later tasks (Task 3) build and pass in. Default value keeps every existing call site (including the three pre-existing self-check tests) working unchanged.

- [ ] **Step 1: Add new failing self-check tests**

Replace the full contents of `src/utils/evaluationAlgorithm.selfcheck.js` with the existing tests A/B/C plus three new ones (D, E, F) appended, and an updated final `console.log`:

```js
// ponytail: sanity check for the peer-evaluator hard cap and its carve-outs,
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

console.log('OK: peer evaluator hard cap, production carve-out, no-fallback rule, and relation-tier fallbacks all hold')
```

- [ ] **Step 2: Run the self-check to confirm the new tests fail**

Run: `node src/utils/evaluationAlgorithm.selfcheck.js`
Expected: Tests A/B/C pass, then an `AssertionError` on Test D (current code has no department-other-team distinction issue here — re-check: if D unexpectedly passes, inspect why before proceeding) or Test E/F (these MUST fail against the current code, since `pickOneEvaluator` doesn't accept or consult `relationLookup` at all yet, and `sameDept`/team-null handling differs). Confirm the script prints `AssertionError` and does not reach the final `console.log`.

- [ ] **Step 3: Implement the algorithm changes**

Replace the full contents of `src/utils/evaluationAlgorithm.js`:

```js
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

const EMPTY_LOOKUP = { teams: new Map(), departments: new Map() }

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
  const eligible = allEmployees.filter(e =>
    e.id !== employee.id &&
    e.id !== employee.manager_id &&
    e.manager_id !== employee.id
  )

  const hasTeam = employee.team_id != null
  const teamPool = hasTeam ? eligible.filter(e => e.team_id === employee.team_id) : []

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

- [ ] **Step 4: Run the self-check to confirm all tests pass**

Run: `node src/utils/evaluationAlgorithm.selfcheck.js`
Expected: `OK: peer evaluator hard cap, production carve-out, no-fallback rule, and relation-tier fallbacks all hold`

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/utils/evaluationAlgorithm.js src/utils/evaluationAlgorithm.selfcheck.js
git commit -m "feat: add department/team relation fallback tier to peer evaluator selection"
```

---

### Task 3: Fetch relations once per cycle in `generateEvaluations.js`

**Files:**
- Modify: `src/utils/generateEvaluations.js` (full file, currently 59 lines)

**Interfaces:**
- Consumes: `selectPeerEvaluators(employee, allEmployees, limit, peerCounts, relationLookup)` from Task 2.
- Produces: no new exports — `generateEvaluationsForCycle(cycleId)` keeps its existing signature and behavior for self/manager/subordinate/general records; only the peer-selection call gains a `relationLookup` argument.

- [ ] **Step 1: Implement the batched relation fetch and lookup builder**

Replace the full contents of `src/utils/generateEvaluations.js`:

```js
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
```

Note: this function does live Supabase I/O and has no existing test harness (unlike the pure `evaluationAlgorithm.js`). Correctness of the pure selection logic is already covered by Task 2's self-check; this task's own correctness (the fetch-once-and-build-lookup wiring) is verified by lint plus the end-to-end manual check in Task 5, which requires Task 1's migration to be applied.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/utils/generateEvaluations.js
git commit -m "feat: fetch department/team relations once per cycle generation"
```

---

### Task 4: `RelationsPanel` component

**Files:**
- Create: `src/components/settings/RelationsPanel.jsx`

**Interfaces:**
- Consumes: CSS classes `st-card`, `st-criteria-row`, `st-criteria-label`, `st-criteria-actions`, `st-action-btn`, `st-settings-label`, `st-settings-hint`, `st-input`, `st-save-btn`, `st-error` (all already defined in `src/pages/Settings.jsx`'s inline `<style>` block), plus two new classes `st-relation-add` and `st-relation-icon` added in Task 5.
- Produces: default export `RelationsPanel({ title, description, nodes, relations, onAdd, onRemove })` where `nodes: [{id, label, groupLabel?}]`, `relations: [{id, aId, aLabel, bId, bLabel}]`, `onAdd: (aId, bId) => Promise<void>`, `onRemove: (relationId) => Promise<void>`.

- [ ] **Step 1: Write the component**

```jsx
import { useMemo, useState } from 'react'
import { Link2, X } from 'lucide-react'

export default function RelationsPanel({ title, description, nodes, relations, onAdd, onRemove }) {
  const [selectedA, setSelectedA] = useState('')
  const [selectedB, setSelectedB] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')

  const groups = useMemo(() => {
    const map = new Map()
    for (const n of nodes) {
      const g = n.groupLabel ?? ''
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(n)
    }
    return [...map.entries()]
  }, [nodes])

  const optionGroups = groups.map(([group, items]) => (
    group
      ? <optgroup key={group} label={group}>
          {items.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
        </optgroup>
      : items.map(n => <option key={n.id} value={n.id}>{n.label}</option>)
  ))

  const pairExists = relations.some(r =>
    (r.aId === selectedA && r.bId === selectedB) ||
    (r.aId === selectedB && r.bId === selectedA)
  )
  const canAdd = selectedA && selectedB && selectedA !== selectedB && !pairExists

  const handleAdd = async () => {
    if (!canAdd) return
    setAdding(true)
    setError('')
    try {
      await onAdd(selectedA, selectedB)
      setSelectedA('')
      setSelectedB('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    setRemovingId(id)
    setError('')
    try {
      await onRemove(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div className="st-settings-label" style={{ marginBottom: 2 }}>{title}</div>
        <p className="st-settings-hint" style={{ marginBottom: 0 }}>{description}</p>
      </div>

      {error && <p className="st-error" style={{ marginBottom: 10 }}>{error}</p>}

      <div className="st-card">
        {relations.length === 0 && (
          <p className="st-settings-hint" style={{ padding: 16, marginBottom: 0 }}>
            Nenhum relacionamento configurado.
          </p>
        )}
        {relations.map(r => (
          <div key={r.id} className="st-criteria-row">
            <span className="st-criteria-label">{r.aLabel} ↔ {r.bLabel}</span>
            <div className="st-criteria-actions">
              <button
                className="st-action-btn"
                onClick={() => handleRemove(r.id)}
                disabled={removingId === r.id}
                title="Remover relacionamento"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}

        <div className="st-relation-add">
          <select className="st-input" value={selectedA} onChange={e => setSelectedA(e.target.value)}>
            <option value="">Selecionar…</option>
            {optionGroups}
          </select>
          <Link2 size={14} className="st-relation-icon" />
          <select className="st-input" value={selectedB} onChange={e => setSelectedB(e.target.value)}>
            <option value="">Selecionar…</option>
            {optionGroups}
          </select>
          <button
            className="st-save-btn"
            onClick={handleAdd}
            disabled={!canAdd || adding}
          >
            {adding ? 'A adicionar…' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors or warnings. (This component isn't wired into the app yet, so `npx eslint src/components/settings/RelationsPanel.jsx` alone won't catch unused-export issues — the full `npm run lint` pass here is a syntax/style check; full behavioral verification happens in Task 5 once it's rendered.)

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/RelationsPanel.jsx
git commit -m "feat: add generic RelationsPanel component for department/team relations"
```

---

### Task 5: Wire `RelationsPanel` into `Settings.jsx`

**Files:**
- Modify: `src/pages/Settings.jsx` (full file, currently 487 lines)

**Interfaces:**
- Consumes: `useDepartments()` from `src/hooks/useDepartments.js` (returns `{ departments }`, each department has `.area` and nested `.teams: [{id, name}]`), `DEPARTMENT_AREAS` from `src/lib/constants.js`, `RelationsPanel` from Task 4.
- Produces: nothing new consumed elsewhere — this is the top-level page.

**Prerequisite:** Task 1's migration must already be applied in the Supabase dashboard, or the two new `supabase.from(...)` calls added below will error on every Settings page load.

- [ ] **Step 1: Add imports**

In `src/pages/Settings.jsx`, replace the import block (lines 1-6):

```js
import { useState, useEffect } from 'react'
import { Settings2, ListChecks, ShieldAlert, User, Check, Network } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useDepartments } from '../hooks/useDepartments'
import { DEPARTMENT_AREAS } from '../lib/constants'
import CriteriaSettings from '../components/settings/CriteriaSettings'
import GeneralSettings from '../components/settings/GeneralSettings'
import RelationsPanel from '../components/settings/RelationsPanel'
```

- [ ] **Step 2: Add state, hook, and extend `load()`**

Replace lines 66-89 (from `export default function Settings()` through the end of `load`):

```js
export default function Settings() {
  const { user, updateDisplayName } = useAuth()
  const [criteria, setCriteria]     = useState([])
  const [settings, setSettings]     = useState({})
  const [departmentRelations, setDepartmentRelations] = useState([])
  const [teamRelations, setTeamRelations] = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const { departments } = useDepartments()

  const load = async () => {
    setLoading(true)
    setLoadError('')
    const [criteriaRes, settingsRes, deptRelRes, teamRelRes] = await Promise.all([
      supabase.from('pf_criteria').select('*').order('sort_order'),
      supabase.from('pf_settings').select('*'),
      supabase.from('pf_department_relations').select('id, department_a_id, department_b_id, department_a:pf_departments!department_a_id(name), department_b:pf_departments!department_b_id(name)'),
      supabase.from('pf_team_relations').select('id, team_a_id, team_b_id, team_a:pf_teams!team_a_id(name), team_b:pf_teams!team_b_id(name)'),
    ])
    if (criteriaRes.error || settingsRes.error || deptRelRes.error || teamRelRes.error) {
      setLoadError(criteriaRes.error?.message ?? settingsRes.error?.message ?? deptRelRes.error?.message ?? teamRelRes.error?.message)
      setLoading(false)
      return
    }
    setCriteria(criteriaRes.data ?? [])
    const map = Object.fromEntries((settingsRes.data ?? []).map(s => [s.key, s.value]))
    setSettings(map)
    setDepartmentRelations((deptRelRes.data ?? []).map(r => ({
      id: r.id, aId: r.department_a_id, aLabel: r.department_a?.name ?? '—',
      bId: r.department_b_id, bLabel: r.department_b?.name ?? '—',
    })))
    setTeamRelations((teamRelRes.data ?? []).map(r => ({
      id: r.id, aId: r.team_a_id, aLabel: r.team_a?.name ?? '—',
      bId: r.team_b_id, bLabel: r.team_b?.name ?? '—',
    })))
    setLoading(false)
  }
```

- [ ] **Step 3: Add relation handlers**

Immediately after the existing `handleSaveSettings` function (previously ending at line 118), add:

```js
  const handleAddDepartmentRelation = async (aId, bId) => {
    const [a, b] = [aId, bId].sort()
    const { error } = await supabase.from('pf_department_relations').insert({ department_a_id: a, department_b_id: b })
    if (error) throw error
    await load()
  }

  const handleRemoveDepartmentRelation = async (id) => {
    const { error } = await supabase.from('pf_department_relations').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  const handleAddTeamRelation = async (aId, bId) => {
    const [a, b] = [aId, bId].sort()
    const { error } = await supabase.from('pf_team_relations').insert({ team_a_id: a, team_b_id: b })
    if (error) throw error
    await load()
  }

  const handleRemoveTeamRelation = async (id) => {
    const { error } = await supabase.from('pf_team_relations').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  const departmentNodes = departments
    .filter(d => d.area === DEPARTMENT_AREAS.ADMINISTRATIVA)
    .map(d => ({ id: d.id, label: d.name }))

  const teamNodes = departments
    .filter(d => d.area === DEPARTMENT_AREAS.PRODUCAO)
    .flatMap(d => d.teams.map(t => ({ id: t.id, label: t.name, groupLabel: d.name })))
```

- [ ] **Step 4: Add the new CSS classes**

In the `<style>` block, insert this right after the `.st-tab.active { ... }` rule (previously ending at line 360) and before the `/* ── Skeleton ── */` comment:

```css
        /* ── Relations ── */
        .st-relation-add {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
        }
        .st-relation-add select.st-input {
          flex: 1;
          min-width: 160px;
        }
        .st-relation-icon {
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
```

- [ ] **Step 5: Add the tab button**

After the "geral" tab button (previously lines 404-409), add:

```jsx
          <button
            className={`st-tab${activeTab === 'relacionamentos' ? ' active' : ''}`}
            onClick={() => setActiveTab('relacionamentos')}
          >
            <Network size={14} /> Relacionamentos
          </button>
```

- [ ] **Step 6: Add the tab content**

After the "geral" tab's closing `)}` (previously line 482) and before the closing `</div>` of the page (previously line 483), add:

```jsx
        {activeTab === 'relacionamentos' && (
          <div className="st-section">
            <div className="st-section-header">
              <div className="st-section-icon" style={{ background: 'rgba(20,160,160,0.08)', color: '#0f9b9b' }}>
                <Network size={16} />
              </div>
              <div>
                <div className="st-section-title">Relacionamentos</div>
                <div className="st-section-desc">
                  Departamentos e equipas relacionados alargam o pool de avaliadores pares quando a própria equipa/departamento não tem colegas suficientes.
                </div>
              </div>
            </div>

            {loading ? (
              <div className="st-skeleton" style={{ height: 220 }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <RelationsPanel
                  title="Relacionamentos entre Departamentos"
                  description="Usado para a área administrativa (departamentos sem equipas)."
                  nodes={departmentNodes}
                  relations={departmentRelations}
                  onAdd={handleAddDepartmentRelation}
                  onRemove={handleRemoveDepartmentRelation}
                />
                <RelationsPanel
                  title="Relacionamentos entre Equipas"
                  description="Usado para a área de produção (equipas dentro de departamentos)."
                  nodes={teamNodes}
                  relations={teamRelations}
                  onAdd={handleAddTeamRelation}
                  onRemove={handleRemoveTeamRelation}
                />
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 8: Manual verification in the browser**

Run: `npm run dev`

1. Navigate to Definições (Settings) → Relacionamentos tab.
2. Confirm two panels render: "Relacionamentos entre Departamentos" (only administrative-area departments in the selects) and "Relacionamentos entre Equipas" (only production-area teams, grouped by department via `<optgroup>`).
3. Add a department relation A↔B. Confirm it appears as a row, and that re-adding the same pair in either order (B, A) leaves the "Adicionar" button disabled.
4. Remove it. Confirm the row disappears.
5. Repeat steps 3-4 for a team relation.
6. Reload the page and confirm both lists persist (proves the Supabase round-trip, not just local state).

- [ ] **Step 9: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "feat: add Relacionamentos tab to Settings for department/team relations"
```
