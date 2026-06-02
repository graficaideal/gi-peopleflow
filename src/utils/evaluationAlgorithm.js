function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function selectPeerEvaluators(employee, allEmployees, limit = 2) {
  const base = allEmployees.filter(e =>
    e.id !== employee.id && e.id !== employee.manager_id
  )

  const sameTeam = base.filter(e => e.team_id === employee.team_id)
  if (sameTeam.length >= limit) {
    return shuffle(sameTeam).slice(0, limit)
  }

  const sameDept = base.filter(e => e.department_id === employee.department_id)
  if (sameDept.length >= limit) {
    return shuffle(sameDept).slice(0, limit)
  }

  // Tier 3 só para colaboradores de departamentos administrativos
  if (employee.department?.area === 'administrativa') {
    const seenIds = new Set(sameDept.map(e => e.id))
    const adminExtra = base.filter(e =>
      !seenIds.has(e.id) && e.department?.area === 'administrativa'
    )
    return shuffle([...sameDept, ...adminExtra]).slice(0, limit)
  }

  return shuffle(sameDept).slice(0, limit)
}
