# Relacionamentos entre Departamentos e Equipas — Design

Data: 2026-07-22

## Objetivo

Permitir configurar relacionamentos bidirecionais entre departamentos (área
administrativa, sem equipas) e entre equipas (área produção, com equipas), e
usar esses relacionamentos como um novo nível de fallback na seleção de
avaliadores peer, substituindo o fallback genérico "mesma área" atual.

## 1. Schema

Nova migration `supabase/migrations/012_relations.sql`:

```sql
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

- `CHECK (a_id < b_id)` forces a canonical ordering (plain UUID/string
  comparison, no semantic meaning). The app always sorts the two chosen ids
  before insert, so `A↔B` and `B↔A` collapse to the same row — "adding" an
  already-existing reversed pair is a no-op / unique-violation the UI treats
  as "already exists."
- `ON DELETE CASCADE` on both FKs: deleting a department/team silently drops
  its relation rows too.
- RLS policies mirror whatever `pf_departments`/`pf_teams` already use
  (checked at implementation time, not re-derived here).

## 2. Algoritmo (`src/utils/evaluationAlgorithm.js`)

### Pool hierarchy (per colaborador avaliado)

1. Mesmo turno/equipa (excluindo próprio, manager, subordinados diretos).
2. Mesmo departamento, outra equipa (aplica-se sobretudo quando o
   departamento tem múltiplas equipas; para departamentos sem equipas,
   reduz-se a "resto do departamento").
3. Equipas relacionadas via `pf_team_relations` (quando o colaborador tem
   `team_id`) OU departamentos relacionados via `pf_department_relations`
   (quando não tem `team_id`) — nunca as duas fontes para o mesmo
   colaborador.
4. Pool ainda vazio → sem avaliação peer, sem fallback adicional.

### Comportamentos preservados de commits recentes

- **Hard cap de 1 avaliação peer por avaliador** (commit `0d854c1`): mantido
  globalmente via `peerCounts` Map partilhado entre todos os colaboradores do
  ciclo.
- **Produção excede o cap dentro da equipa** (commit `0f11b5a`): se a equipa
  de um colaborador de área `producao` esgotar o cap (tier 1), reutiliza
  colegas de equipa (o menos utilizado primeiro) em vez de avançar de tier.
  Isto continua a acontecer *antes* de tentar tier 2/3.
- **Team lead sem colegas elegíveis na equipa = paragem imediata** (commit
  `869fcda`): se o colaborador **tem** `team_id` mas, depois de excluir
  manager/subordinados diretos, a equipa fica estruturalmente vazia (ex: lead
  cujos únicos colegas são subordinados diretos), a função devolve `[]`
  imediatamente — **sem** avançar para tier 2/3. Este é um "hard stop"
  distinto do esgotamento por cap.

### Correção de fronteira: `team_id = NULL`

Colaboradores de departamentos administrativos sem equipas têm
`team_id = NULL`. O filtro de "mesma equipa" nunca deve considerar dois
`NULL` como a mesma equipa (isso juntaria colaboradores de departamentos
administrativos diferentes). Nestes casos, tier 1 é sempre vazio por
definição e o "hard stop" do parágrafo anterior **não** se aplica (só se
aplica quando `hasTeam` é verdadeiro) — o colaborador avança diretamente
para tier 2/3.

### Pseudocódigo

```js
function pickOneEvaluator(employee, available, teamPool, isProducao, peerCounts, relationLookup) {
  const sameTeamAvailable = employee.team_id
    ? available.filter(e => e.team_id === employee.team_id)
    : []
  if (sameTeamAvailable.length) return shuffle(sameTeamAvailable)[0]

  if (isProducao && teamPool.length) {
    return shuffle(teamPool).sort((a, b) => (peerCounts.get(a.id) ?? 0) - (peerCounts.get(b.id) ?? 0))[0]
  }

  // Tier 2: mesmo departamento, outra equipa
  const sameDeptOtherTeam = available.filter(e =>
    e.department_id === employee.department_id &&
    (employee.team_id == null || e.team_id !== employee.team_id)
  )
  if (sameDeptOtherTeam.length) return shuffle(sameDeptOtherTeam)[0]

  // Tier 3: equipas/departamentos relacionados
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

export function selectPeerEvaluators(employee, allEmployees, limit = 2, peerCounts = new Map(), relationLookup) {
  const eligible = allEmployees.filter(e =>
    e.id !== employee.id && e.id !== employee.manager_id && e.manager_id !== employee.id
  )

  const hasTeam = employee.team_id != null
  const teamPool = hasTeam ? eligible.filter(e => e.team_id === employee.team_id) : []
  if (hasTeam && !teamPool.length) return []   // lead whose only teammates are direct reports: hard stop

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

`relationLookup` shape:

```js
{
  teams: Map<team_id, Set<related_team_id>>,
  departments: Map<department_id, Set<related_department_id>>,
}
```

### `src/utils/generateEvaluations.js`

The initial batched `Promise.all` (currently fetching employees, the peer
limit setting, the special evaluator, and cycle end date) gains two more
queries: `pf_team_relations` and `pf_department_relations`. Each relation
row `(a_id, b_id)` expands into both directions when building the `Map`s
(`teams.get(a_id).add(b_id)` and `teams.get(b_id).add(a_id)`, same for
departments). This lookup is built **once**, before the per-employee loop,
and passed into every `selectPeerEvaluators` call — matching the existing
pattern already used for `peerCounts` and the employees array.

### Self-check

Extend `evaluationAlgorithm.selfcheck.js` (existing `node`-run assert-based
check, no framework) with new cases:
- Tier 2 fires when tier 1 is cap-exhausted and the department has another
  team with available people.
- Tier 3 fires when tier 1 and 2 are exhausted/absent but a related
  team/department has available people.
- `team_id = NULL` employees from two different departments never pool
  together at tier 1.
- Existing Tests A/B/C continue to pass unchanged.

## 3. Interface (Settings.jsx)

### New component: `src/components/settings/RelationsPanel.jsx`

Generic, reused for both departments and teams:

Props:
- `title`, `description` — panel header text.
- `nodes: [{id, label, groupLabel?}]` — selectable options for the two add
  selects. `groupLabel` (team's department name) renders an `<optgroup>`.
- `relations: [{id, aId, aLabel, bId, bLabel}]` — existing pairs to list.
- `onAdd(aId, bId)`, `onRemove(relationId)`.

Rendering follows the existing `CriteriaSettings` row pattern: each relation
is an `"A ↔ B"` row with a hover-reveal remove icon, plus an add-row at the
bottom with two `<select>`s and an "Adicionar" button. The button is
disabled when both selects are empty, equal, or the pair already exists in
`relations` (checked either direction).

### `Settings.jsx` changes

- New tab `relacionamentos` ("Relacionamentos") alongside `perfil`,
  `criterios`, `geral`.
- Calls `useDepartments()` to get departments with nested `.teams` and
  `.area`.
- Extends the existing mount-time `Promise.all` with two more Supabase
  queries: `pf_department_relations` and `pf_team_relations`, each joined to
  fetch both sides' names for display (e.g.
  `select('*, department_a:pf_departments!department_a_id(name), department_b:pf_departments!department_b_id(name)')`).
- Renders two `<RelationsPanel>` instances under the new tab:
  - **Departamentos**: `nodes` = departments where `area === 'administrativa'`.
  - **Equipas**: `nodes` = teams belonging to departments where
    `area === 'producao'`, each tagged with `groupLabel` = department name.
- Add/remove handlers: plain Supabase insert/delete. On add, sort
  `[idA, idB]` before insert to satisfy the canonical-order `CHECK`
  constraint; on unique-violation (pair already exists), surface a friendly
  "já existe" message instead of a raw DB error. On success, update local
  state (same shape as existing `handleSaveSettings`/criteria handlers — no
  full refetch needed).

## Out of scope

- No new `pf_settings` keys.
- No UI enforcement preventing an admin from creating a relation between,
  e.g., two teams in the same department (redundant with tier 2, but
  harmless — tier 2 already covers same-department pairs before tier 3 is
  ever consulted).
- No changes to the `self` / `manager` / `subordinate` / `general`
  evaluation-type generation paths in `generateEvaluations.js`.
