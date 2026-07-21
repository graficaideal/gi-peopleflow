function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

// Escolhe um avaliador ainda disponível (0 avaliações peer atribuídas), alargando
// equipa → departamento → área conforme necessário, com desempate aleatório.
function pickOneEvaluator(employee, available) {
  const sameTeam = available.filter(e => e.team_id === employee.team_id)
  if (sameTeam.length) return shuffle(sameTeam)[0]

  const sameDept = available.filter(e => e.department_id === employee.department_id)
  if (sameDept.length) return shuffle(sameDept)[0]

  // Tier 3: alarga à área do colaborador (administrativa ou produção), nunca a ambas
  const sameArea = available.filter(e => e.department?.area === employee.department?.area)
  if (sameArea.length) return shuffle(sameArea)[0]

  return null
}

// Cada avaliador só pode ser escolhido 1 vez em todo o ciclo (hard cap), por isso o pool
// exclui quem já tem uma avaliação peer atribuída. Se o pool se esgotar, o colaborador
// fica com menos avaliadores que `limit` em vez de reutilizar alguém já carregado.
export function selectPeerEvaluators(employee, allEmployees, limit = 2, peerCounts = new Map()) {
  const base = allEmployees.filter(e =>
    e.id !== employee.id &&
    e.id !== employee.manager_id &&
    e.manager_id !== employee.id &&
    !(peerCounts.get(e.id) > 0)
  )

  const selected = []
  const pickedIds = new Set()

  for (let i = 0; i < limit; i++) {
    const evaluator = pickOneEvaluator(employee, base.filter(e => !pickedIds.has(e.id)))
    if (!evaluator) break

    pickedIds.add(evaluator.id)
    peerCounts.set(evaluator.id, (peerCounts.get(evaluator.id) ?? 0) + 1)
    selected.push(evaluator)
  }

  return selected
}
