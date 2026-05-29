/**
 * Randomly selects peer evaluators for a given employee.
 * Excludes the employee themselves and their direct manager.
 *
 * @param {object} employee - The employee being evaluated
 * @param {array} allEmployees - All employees in the same team/department
 * @param {number} limit - Max number of peer evaluators to assign
 * @returns {array} - Selected evaluators
 */
export function selectPeerEvaluators(employee, allEmployees, limit = 2) {
  const eligible = allEmployees.filter(e =>
    e.id !== employee.id &&
    e.id !== employee.manager_id &&
    e.team_id === employee.team_id
  )

  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, limit)
}
