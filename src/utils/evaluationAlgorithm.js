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
