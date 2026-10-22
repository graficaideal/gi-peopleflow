// ponytail: sanity check for the report aggregations, no framework needed.
// Run with: node src/utils/reports.selfcheck.js
import assert from 'node:assert/strict'
import { buildEvaluationReport, withObservations, groupByEvaluatee, fetchAll, normalizeSearch } from './reports.js'

assert.equal(normalizeSearch('  João CONCEIÇÃO '), 'joao conceicao', 'normalizeSearch strips accents/case')

const TYPES = ['self', 'peer', 'manager', 'general', 'subordinate']
const emp = (id, full_name, dept, team, employee_number = id) => ({
  id, full_name, employee_number,
  department: dept ? { name: dept } : null,
  team: team ? { name: team } : null,
})
const ev = (evaluatee_id, type, status, scores) => ({
  evaluatee_id, type, status, answers: scores.map(score => ({ score })),
})

// --- Test A: averages pool scores, skip N/A, ignore non-submitted ------------------
{
  const { types, rows, footer } = buildEvaluationReport(
    [emp('1', 'Zé', 'Produção', null, '10'), emp('2', 'Ana', 'Produção', null, '9'), emp('3', 'Rui', null), emp('4', 'Bia', 'Adm', null, '100')],
    [
      ev('1', 'self', 'submitted', [5, 3, null]),   // self 4
      ev('1', 'peer', 'submitted', [2]),            // peer 2 -> global (5+3+2)/3
      ev('1', 'peer', 'pending', [1, 1]),           // ignored for averages
      ev('2', 'manager', 'sent', []),               // column exists, no data
      ev('4', 'general', 'cancelled', [5]),         // cancelled: no column, no data
    ],
    TYPES,
  )
  assert.deepEqual(types, ['self', 'peer', 'manager'], 'A: types present (non-cancelled), in order')
  assert.deepEqual(rows.map(r => r.employee.employee_number), ['3', '9', '10', '100'], 'A: numeric employee_number order')
  const ze = rows.find(r => r.employee.id === '1')
  assert.equal(ze.byType.self, 4, 'A: self avg skips N/A')
  assert.equal(ze.byType.peer, 2, 'A: pending peer ignored')
  assert.equal(ze.global, 10 / 3, 'A: global pools scores')
  assert.equal(rows.find(r => r.employee.id === '2').global, null, 'A: no submitted -> null')
  assert.equal(footer.evaluated, 1, 'A: footer count')
  assert.equal(footer.global, 10 / 3, 'A: footer ignores nulls')
  assert.equal(footer.byType.manager, null, 'A: empty column footer null')
}

// --- Test B: observations filter + grouping ----------------------------------------
{
  const items = withObservations([
    { id: 'a', notes: '  ', answers: [{ score: 3, notes: '' }], evaluatee: { id: 'x', full_name: 'Zé' } },
    { id: 'b', notes: 'Bom', answers: [], evaluatee: { id: 'y', full_name: 'Ana' } },
    {
      id: 'c', notes: null,
      answers: [
        { score: null, notes: 'n/a nota', criteria: { label: 'C2', sort_order: 2 } },
        { score: 4, notes: 'ok', criteria: [{ label: 'C1', sort_order: 1 }] },
      ],
      evaluatee: [{ id: 'y', full_name: 'Ana' }],
    },
  ])
  assert.deepEqual(items.map(i => i.id), ['b', 'c'], 'B: blank notes dropped')
  assert.deepEqual(items[1].criteriaNotes.map(c => [c.criteria.label, c.na]), [['C1', false], ['C2', true]], 'B: sorted, N/A flagged')
  const groups = groupByEvaluatee(items)
  assert.equal(groups.length, 1, 'B: grouped by evaluatee (array/object joins normalized)')
  assert.equal(groups[0].notes.length, 2, 'B: both evaluations under Ana')
}

// --- Test C: fetchAll pages until a short page --------------------------------------
{
  const data = Array.from({ length: 5 }, (_, i) => i)
  const calls = []
  const makeQuery = () => ({
    range: async (from, to) => { calls.push(from); return { data: data.slice(from, to + 1), error: null } },
  })
  assert.deepEqual(await fetchAll(makeQuery, 2), data, 'C: all rows returned')
  assert.deepEqual(calls, [0, 2, 4], 'C: stops on short page')
}

console.log('reports.selfcheck: OK')
