# Simulação de Ciclo — Design

Data: 2026-07-23

## Objetivo

Antes de ativar um ciclo (`draft` → `active`), permitir pré-visualizar o
resultado do algoritmo de geração de avaliações — quantas avaliações de cada
tipo seriam criadas, quais colaboradores ficariam sem avaliador peer e quais
pares só se formaram por fallback de departamento/relacionamento — sem
gravar nada na base de dados. Serve também para validar ajustes feitos em
`Definições → Relacionamentos` antes de confirmar a ativação real.

## 1. Extração de lógica pura reutilizável

Hoje `generateEvaluationsForCycle` (`src/utils/generateEvaluations.js`)
mistura, no mesmo loop, a decisão de quem avalia quem com a construção dos
registos a gravar (`cycle_id`, `token`, `token_expires_at`) e o upsert final.
A simulação precisa da primeira parte sem a segunda.

### Novo ficheiro: `src/utils/simulateEvaluations.js` (puro, sem Supabase)

```js
export function buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 }) {
  // devolve:
  // {
  //   assignments: [{ evaluateeId, evaluatorId, type }],   // self/manager/subordinate/general/peer
  //   peerRows: [{ evaluatee, evaluator, tier }],           // um por par peer atribuído
  //                                                          // tier: 'team' | 'department' | 'relation'
  //   noPeer: [{ evaluatee, reason }],                      // reason: 'no_teammates' | 'all_manager_or_subordinate' | 'pool_exhausted'
  // }
}
```

- Corre exatamente a mesma iteração que hoje existe em
  `generateEvaluationsForCycle` (self, manager+subordinate, peer via
  `selectPeerEvaluators`, general via `evaluator0072`), mas em vez de chamar
  `makeRecord(...)` guarda `{ evaluateeId, evaluatorId, type }` em
  `assignments`.
- **Classificação do nível de fallback** (`tier`) é calculada *a posteriori*,
  comparando avaliador vs. avaliado — não requer alterar
  `selectPeerEvaluators` nem o seu contrato de retorno:
  - `evaluator.team_id === evaluatee.team_id` → `'team'`
  - senão `evaluator.department_id === evaluatee.department_id` → `'department'`
  - senão (só pode ter vindo de tier 3) → `'relation'`
- **Motivo de "sem par"** (só quando `selectPeerEvaluators` devolve `[]` para
  o colaborador, i.e. zero peers atribuídos):
  - `hasTeam && teamPool.length === 0` (equipa sem ninguém elegível, mesmo
    antes de excluir manager/subordinados) → `'no_teammates'`
  - `hasTeam` mas o hard-stop de `selectPeerEvaluators` disparou porque os
    únicos colegas de equipa são manager/subordinados diretos →
    `'all_manager_or_subordinate'`
  - qualquer outro caso de zero peers (sem equipa, ou equipa esgotada, e
    departamento/relacionamentos também vazios) → `'pool_exhausted'`
  - Nota: só entra em `noPeer` quem fica com **zero** peers; um colaborador
    com menos peers que o limite mas pelo menos 1 não é considerado alerta
    crítico.

### `evaluationAlgorithm.js`: pequeno export adicional

Para classificar o motivo de "sem par" sem duplicar regras de elegibilidade,
extraio as 2 linhas já existentes (`eligible`, `teamPool`) para uma função
exportada:

```js
export function getTeamPool(employee, allEmployees) {
  const eligible = allEmployees.filter(e =>
    e.id !== employee.id && e.id !== employee.manager_id && e.manager_id !== employee.id
  )
  const hasTeam = employee.team_id != null
  const teamPool = hasTeam ? eligible.filter(e => e.team_id === employee.team_id) : []
  return { eligible, hasTeam, teamPool }
}
```

`selectPeerEvaluators` passa a usar este helper internamente (sem mudança de
comportamento — confirmado correndo `evaluationAlgorithm.selfcheck.js`
depois do refactor). `buildEvaluationPlan` usa o mesmo helper para decidir
`no_teammates` vs. `all_manager_or_subordinate` vs. `pool_exhausted`.

### `generateEvaluations.js`: passa a consumir `buildEvaluationPlan`

O loop principal é substituído pela chamada a `buildEvaluationPlan(...)`;
`assignments` é depois mapeado para registos (`makeRecord` com `cycle_id`,
`token`, `token_expires_at`) e gravado com o upsert existente — sem mudança
de comportamento observável.

## 2. Página `src/pages/CycleSimulation.jsx`

Rota `/cycles/:id/simulate`, adicionada em `App.jsx` dentro do
`ProtectedRoute`, ao lado das restantes rotas de `/cycles`.

### Fetch (mesmas queries que `generateEvaluationsForCycle`, sem tokens)

- Ciclo (nome, status) — via `useCycles()` (já usado em `Cycles.jsx`),
  procurando pelo `:id` do URL em `cycles`. Reutilizar o hook em vez de uma
  query direta dá-nos também `updateCycle` já pronto para o botão "Ativar
  Ciclo" (ver abaixo), sem duplicar a lógica de despromover outro ciclo
  ativo + chamar `generateEvaluationsForCycle`.
- `pf_employees` ativos com `department:pf_departments(name, area)`,
  `team:pf_teams(name)`.
- `pf_settings` → `peer_evaluator_limit`.
- `pf_employees` → colaborador de `employee_number = '0072'` (avaliador
  geral).
- `pf_team_relations`, `pf_department_relations` → `buildRelationLookup`.

Corre `buildEvaluationPlan(...)` com estes dados. "Simular novamente" repete
o fetch + cálculo do zero (útil depois de editar relacionamentos nas
Definições).

### Estrutura visual

1. **Header**: link "voltar" para `/cycles`, nome do ciclo, botões
   "Simular novamente" (secundário) e "Ativar Ciclo" (primário).
2. **Cards de resumo**:
   - Total por tipo: self ("Auto"), peer, manager, general, subordinate —
     contam entradas em `assignments` por `type`.
   - "Colaboradores sem peer" — `noPeer.length`.
   - "Pares peer com fallback" — `peerRows.filter(r => r.tier !== 'team').length`.
   - "Alertas" — `noPeer.length + peerRows.filter(r => r.tier !== 'team').length`.
3. **Secção de alertas** (só renderiza se algum dos dois grupos não estiver
   vazio):
   - Lista vermelha: um item por `noPeer` — nome do colaborador + motivo em
     texto (`no_teammates` → "Sem colegas de equipa", `all_manager_or_subordinate`
     → "Só chefia/subordinados na equipa", `pool_exhausted` → "Pool esgotado
     mesmo com fallback").
   - Lista amarela: um item por `peerRows` com `tier !== 'team'` — "Avaliado
     ↔ Avaliador (nível: Departamento/Relacionamento)".
4. **Tabela de distribuição peer** — colunas: Avaliado, Equipa, Avaliador,
   Equipa do Avaliador, Nível de fallback.
   - Uma linha por entrada de `peerRows` (nível "Equipa"/"Departamento"/"Relacionamento").
   - Mais uma linha por entrada de `noPeer` — Avaliador = "—", nível = "Sem par".
   - Filtros client-side (dropdowns, sem chamadas extra): por departamento do
     avaliado, e por nível de fallback (Todos/Equipa/Departamento/Relacionamento/Sem par).
   - Reutiliza `components/ui/Table.jsx` e `components/ui/Select.jsx`.
5. **Ativar Ciclo**:
   - Se `noPeer.length > 0`: abre modal de confirmação explícita
     (`components/ui/Modal.jsx`) listando quantos colaboradores ficam sem
     peer, exigindo clique explícito em "Ativar mesmo assim" para prosseguir.
   - Caso contrário, ativa diretamente.
   - Ativar = chamar `updateCycle(id, { status: 'active' })` do `useCycles()`
     já usado para o fetch do ciclo — o próprio hook já despromove qualquer
     outro ciclo `active` para `draft` e chama `generateEvaluationsForCycle`
     (grava a sério, desta vez). Depois navega para `/cycles`.
   - Se o ciclo já não estiver em `draft` (acesso direto por URL depois de
     ativado por outra via), a simulação continua visível mas o botão
     "Ativar Ciclo" fica desativado com uma nota explicativa.

### `CycleCard.jsx`

Novo botão "Simular" (ícone `Eye`/`FlaskConical`, a escolher na
implementação), visível só quando `cycle.status === 'draft'`, ao lado do
botão de ativar existente — navega para `/cycles/${cycle.id}/simulate`.

## 3. Self-check

`evaluationAlgorithm.selfcheck.js` continua a passar sem alterações de
comportamento (o refactor de `getTeamPool` é extração pura). Acrescenta-se um
novo `src/utils/simulateEvaluations.selfcheck.js` (mesmo padrão `node` +
`assert`, sem framework) cobrindo:
- Um colaborador com fallback tier 2 aparece em `peerRows` com
  `tier: 'department'`.
- Um colaborador com fallback tier 3 aparece com `tier: 'relation'`.
- Um "hard stop" (equipa só com subordinados) aparece em `noPeer` com
  `reason: 'all_manager_or_subordinate'`.
- Uma equipa vazia aparece em `noPeer` com `reason: 'no_teammates'`.
- Contagem de `assignments` por tipo bate certo com o nº de colaboradores e
  managers.

## Fora de âmbito

- Não altera o schema (nenhuma migration nova).
- Não altera os tipos `self`/`manager`/`subordinate`/`general` além de os
  expor em `assignments` — a lógica desses tipos mantém-se igual.
- Não persiste o resultado da simulação (cada visita à página recalcula do
  zero a partir do estado atual da base de dados).
- Não pagina a tabela de distribuição — assume-se volume compatível com o nº
  de colaboradores desta organização (dezenas, não milhares).
