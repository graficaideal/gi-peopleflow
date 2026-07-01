function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

// Seleciona os `limit` elegíveis menos sobrecarregados (contador de seleções mais baixo),
// desempatando aleatoriamente, e atualiza o contador para os escolhidos.
function pickLeastLoaded(pool, limit, peerCounts) {
  const selected = shuffle(pool)
    .sort((a, b) => (peerCounts.get(a.id) ?? 0) - (peerCounts.get(b.id) ?? 0))
    .slice(0, limit)

  for (const person of selected) {
    peerCounts.set(person.id, (peerCounts.get(person.id) ?? 0) + 1)
  }
  return selected
}

export function selectPeerEvaluators(employee, allEmployees, limit = 2, peerCounts = new Map()) {
  const base = allEmployees.filter(e =>
    e.id !== employee.id && e.id !== employee.manager_id
  )

  const sameTeam = base.filter(e => e.team_id === employee.team_id)
  if (sameTeam.length >= limit) {
    return pickLeastLoaded(sameTeam, limit, peerCounts)
  }

  const sameDept = base.filter(e => e.department_id === employee.department_id)
  if (sameDept.length >= limit) {
    return pickLeastLoaded(sameDept, limit, peerCounts)
  }

  // Tier 3 só para colaboradores de departamentos administrativos
  if (employee.department?.area === 'administrativa') {
    const seenIds = new Set(sameDept.map(e => e.id))
    const adminExtra = base.filter(e =>
      !seenIds.has(e.id) && e.department?.area === 'administrativa'
    )
    return pickLeastLoaded([...sameDept, ...adminExtra], limit, peerCounts)
  }

  return pickLeastLoaded(sameDept, limit, peerCounts)
}
