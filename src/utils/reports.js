// Pure helpers for the Reports pages (no Supabase import, so the selfcheck runs in node).

const one = v => (Array.isArray(v) ? v[0] : v)
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const byName = (a, b) => (a ?? '').localeCompare(b ?? '', 'pt')

// Case- and accent-insensitive ('joao' matches 'João')
export const normalizeSearch = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const formatAvg =(v, empty = '—') => (v == null ? empty : v.toFixed(1))

// PostgREST caps each response at 1000 rows: page until a short page comes back.
// makeQuery must return a fresh, stably ordered query builder on every call.
export async function fetchAll(makeQuery, pageSize = 1000) {
  const out = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < pageSize) return out
  }
}

// Report 1. Averages pool every answered score (N/A = null is skipped), matching
// EmployeeDetail/Dashboard. Footer = mean of the row values (each employee weighs the same).
export function buildEvaluationReport(employees, evaluations, typeOrder) {
  const live = evaluations.filter(e => e.status !== 'cancelled')
  const types = typeOrder.filter(t => live.some(e => e.type === t))

  const scores = new Map() // evaluatee_id -> { [type]: number[] }
  live.filter(e => e.status === 'submitted').forEach(e => {
    const s = (e.answers ?? []).map(a => a.score).filter(n => typeof n === 'number')
    if (!scores.has(e.evaluatee_id)) scores.set(e.evaluatee_id, {})
    const byType = scores.get(e.evaluatee_id)
    ;(byType[e.type] ??= []).push(...s)
  })

  const rows = employees
    .map(emp => {
      const byType = scores.get(emp.id) ?? {}
      return {
        employee: emp,
        department: one(emp.department)?.name ?? null,
        team: one(emp.team)?.name ?? null,
        global: mean(Object.values(byType).flat()),
        byType: Object.fromEntries(types.map(t => [t, mean(byType[t] ?? [])])),
      }
    })
    // employee_number is TEXT: numeric collation so '10' sorts after '9'
    .sort((a, b) => (a.employee.employee_number ?? '').localeCompare(b.employee.employee_number ?? '', 'pt', { numeric: true }))

  const colMean = pick => mean(rows.map(pick).filter(v => v != null))
  const footer = {
    evaluated: rows.filter(r => r.global != null).length,
    global: colMean(r => r.global),
    byType: Object.fromEntries(types.map(t => [t, colMean(r => r.byType[t])])),
  }

  return { types, rows, footer }
}

// Report 2 / CycleNotesModal. Keeps only evaluations with a general note or criterion notes.
export function withObservations(evaluations) {
  return evaluations
    .map(e => ({
      ...e,
      evaluator: one(e.evaluator),
      evaluatee: one(e.evaluatee),
      notes: e.notes?.trim() || null,
      criteriaNotes: (e.answers ?? [])
        .map(a => ({ note: a.notes?.trim(), na: a.score == null, criteria: one(a.criteria) }))
        .filter(a => a.note)
        .sort((a, b) => (a.criteria?.sort_order ?? 0) - (b.criteria?.sort_order ?? 0)),
    }))
    .filter(e => e.notes || e.criteriaNotes.length)
}

export function groupByEvaluatee(items) {
  const byEmp = new Map()
  items.forEach(item => {
    const e = item.evaluatee
    if (!byEmp.has(e?.id)) {
      byEmp.set(e?.id, { id: e?.id, name: e?.full_name ?? '—', department: one(e?.department)?.name ?? null, notes: [] })
    }
    byEmp.get(e?.id).notes.push(item)
  })
  return [...byEmp.values()].sort((a, b) => byName(a.name, b.name))
}
