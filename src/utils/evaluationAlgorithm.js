function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

// Escolhe um avaliador ainda disponível (0 avaliações peer atribuídas), alargando
// equipa → departamento → área conforme necessário, com desempate aleatório.
// `teamPool` é o pool bruto da equipa (ignora o limite de 1); se a equipa da produção
// estiver esgotada só por limite, excede-o ali em vez de mudar de turno/departamento.
function pickOneEvaluator(employee, available, teamPool, isProducao, peerCounts) {
  const sameTeamAvailable = available.filter(e => e.team_id === employee.team_id)
  if (sameTeamAvailable.length) return shuffle(sameTeamAvailable)[0]

  if (isProducao && teamPool.length) {
    return shuffle(teamPool).sort((a, b) => (peerCounts.get(a.id) ?? 0) - (peerCounts.get(b.id) ?? 0))[0]
  }

  const sameDept = available.filter(e => e.department_id === employee.department_id)
  if (sameDept.length) return shuffle(sameDept)[0]

  // Tier 3: alarga à área do colaborador (administrativa ou produção), nunca a ambas
  const sameArea = available.filter(e => e.department?.area === employee.department?.area)
  if (sameArea.length) return shuffle(sameArea)[0]

  return null
}

// Cada avaliador só pode ser escolhido 1 vez em todo o ciclo (hard cap), por isso o pool
// exclui quem já tem uma avaliação peer atribuída. Se o pool se esgotar, o colaborador
// fica com menos avaliadores que `limit` em vez de reutilizar alguém já carregado
// (exceto na equipa de produção — ver `pickOneEvaluator`).
export function selectPeerEvaluators(employee, allEmployees, limit = 2, peerCounts = new Map()) {
  const eligible = allEmployees.filter(e =>
    e.id !== employee.id &&
    e.id !== employee.manager_id &&
    e.manager_id !== employee.id
  )

  // Responsável de turno/equipa cujos colegas são todos subordinados diretos: sem
  // colegas de equipa elegíveis, sem avaliação peer, sem fallback para outro turno
  // ou departamento.
  const teamPool = eligible.filter(e => e.team_id === employee.team_id)
  if (!teamPool.length) return []

  const isProducao = employee.department?.area === 'producao'
  const base = eligible.filter(e => !(peerCounts.get(e.id) > 0))

  const selected = []
  const pickedIds = new Set()

  for (let i = 0; i < limit; i++) {
    const available = base.filter(e => !pickedIds.has(e.id))
    const remainingTeamPool = teamPool.filter(e => !pickedIds.has(e.id))
    const evaluator = pickOneEvaluator(employee, available, remainingTeamPool, isProducao, peerCounts)
    if (!evaluator) break

    pickedIds.add(evaluator.id)
    peerCounts.set(evaluator.id, (peerCounts.get(evaluator.id) ?? 0) + 1)
    selected.push(evaluator)
  }

  return selected
}
