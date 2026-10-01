import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { EVALUATION_TYPE_LABELS } from '../../lib/constants'

// Reuses the cy-* modal/input styles defined in pages/Cycles.jsx
export default function CycleNotesModal({ cycle, onClose }) {
  const [rows, setRows]     = useState(null) // null = loading
  const [error, setError]   = useState('')
  const [dept, setDept]     = useState('all')

  useEffect(() => {
    // Anonymous cycles: never request the evaluator at all.
    const evaluatorCol = cycle.anonymous ? '' : ', evaluator:pf_employees!evaluator_id(full_name)'
    supabase
      .from('pf_evaluations')
      .select(`
        id, type, notes${evaluatorCol},
        answers:pf_evaluation_answers(notes, criteria:pf_criteria(label, sort_order)),
        evaluatee:pf_employees!evaluatee_id(id, full_name, department:pf_departments(id, name))
      `)
      .eq('cycle_id', cycle.id)
      .eq('status', 'submitted')
      .then(({ data, error }) => {
        if (error) { setError(error.message); setRows([]); return }
        const withNotes = (data ?? []).map(e => ({
          ...e,
          notes: e.notes?.trim() || null,
          criteriaNotes: (e.answers ?? [])
            .map(a => ({ note: a.notes?.trim(), criteria: Array.isArray(a.criteria) ? a.criteria[0] : a.criteria }))
            .filter(a => a.note)
            .sort((a, b) => (a.criteria?.sort_order ?? 0) - (b.criteria?.sort_order ?? 0)),
        }))
        setRows(withNotes.filter(e => e.notes || e.criteriaNotes.length))
      })
  }, [cycle.id, cycle.anonymous])

  const departments = useMemo(() => {
    const map = new Map()
    ;(rows ?? []).forEach(r => { const d = r.evaluatee?.department; if (d) map.set(d.id, d.name) })
    return [...map].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const groups = useMemo(() => {
    const byEmp = new Map()
    ;(rows ?? [])
      .filter(r => dept === 'all' || r.evaluatee?.department?.id === dept)
      .forEach(r => {
        const e = r.evaluatee
        if (!byEmp.has(e?.id)) byEmp.set(e?.id, { name: e?.full_name ?? '—', notes: [] })
        byEmp.get(e?.id).notes.push(r)
      })
    return [...byEmp.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, dept])

  return (
    <div className="cy-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cy-modal" style={{ maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="cy-modal-header">
          <span className="cy-modal-title">Observações · {cycle.name}</span>
          <button className="cy-modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="cy-modal-body" style={{ overflowY: 'auto' }}>
          {rows === null ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>A carregar…</div>
          ) : error ? (
            <div style={{ color: '#e05252', fontSize: 13 }}>{error}</div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '16px 0' }}>
              Sem observações registadas
            </div>
          ) : (
            <>
              <select className="cy-input" value={dept} onChange={e => setDept(e.target.value)}>
                <option value="all">Todos os departamentos</option>
                {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>

              {groups.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Sem observações neste departamento.
                </div>
              )}

              {groups.map(g => (
                <div key={g.name}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>{g.name}</div>
                  {g.notes.map(n => (
                    <div key={n.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: '2px solid var(--color-border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                        {EVALUATION_TYPE_LABELS[n.type] ?? n.type}
                        {' · '}
                        {cycle.anonymous ? 'Anónimo' : n.evaluator?.full_name ?? '—'}
                      </div>
                      {n.notes && (
                        <div style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{n.notes}</div>
                      )}
                      {n.criteriaNotes.map((cn, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-wrap', marginTop: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{cn.criteria?.label ?? '—'}: </span>
                          {cn.note}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="cy-modal-footer">
          <button className="cy-btn cy-btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
