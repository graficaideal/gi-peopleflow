import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileDown } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCycles } from '../hooks/useCycles'
import { useDepartments } from '../hooks/useDepartments'
import { CYCLE_STATUSES, EVALUATION_TYPE_LABELS } from '../lib/constants'
import { fetchAll, withObservations, groupByEvaluatee } from '../utils/reports'
import { exportReportPdf, pdfFilename } from '../utils/reportPdf'

// One line per observation: the general note first, then criterion notes.
const observationLines = n => [
  ...(n.notes ? [{ label: 'Observação geral', text: n.notes }] : []),
  ...n.criteriaNotes.map(cn => ({ label: `${cn.criteria?.label ?? '-'}${cn.na ? ' (N/A)' : ''}`, text: cn.note })),
]

export default function ReportObservations() {
  const { cycles: allCycles, loading: cyclesLoading } = useCycles()
  // Reports only cover finalized cycles
  const cycles = allCycles.filter(c => c.status === CYCLE_STATUSES.CLOSED)
  const { departments } = useDepartments()
  const [cycleId, setCycleId] = useState('')
  const [deptId, setDeptId]   = useState('')
  const [type, setType]       = useState('')
  const [items, setItems]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [exporting, setExporting] = useState(false)

  const cycle = cycles.find(c => c.id === cycleId)

  useEffect(() => {
    if (!cycleId) { setItems(null); return }
    let stale = false
    setLoading(true)
    setError('')
    // Evaluator is always requested: this report deliberately ignores cycle anonymity.
    fetchAll(() => supabase
      .from('pf_evaluations')
      .select(`
        id, type, notes,
        evaluator:pf_employees!evaluator_id(full_name),
        answers:pf_evaluation_answers(score, notes, criteria:pf_criteria(label, sort_order)),
        evaluatee:pf_employees!evaluatee_id(id, full_name, department:pf_departments(id, name))
      `)
      .eq('cycle_id', cycleId)
      .eq('status', 'submitted')
      .order('id'))
      .then(data => { if (!stale) setItems(withObservations(data)) })
      .catch(err => { if (!stale) { setError(err.message); setItems(null) } })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [cycleId])

  const groups = useMemo(() => groupByEvaluatee((items ?? []).filter(n =>
    (!deptId || n.evaluatee?.department?.id === deptId) && (!type || n.type === type)
  )), [items, deptId, type])

  const filtersLabel = [
    deptId && `Departamento: ${departments.find(d => d.id === deptId)?.name}`,
    type && `Tipo: ${EVALUATION_TYPE_LABELS[type]}`,
    cycle?.anonymous && 'Ciclo anónimo: identidade dos avaliadores visível',
  ].filter(Boolean).join(' | ')

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      const body = groups.flatMap(g => [
        [{
          content: g.department ? `${g.name} (${g.department})` : g.name,
          colSpan: 4,
          styles: { fontStyle: 'bold', fillColor: [238, 239, 241] },
        }],
        ...g.notes.flatMap(n => observationLines(n).map(l => [
          EVALUATION_TYPE_LABELS[n.type] ?? n.type,
          n.evaluator?.full_name ?? '-',
          l.label,
          l.text,
        ])),
      ])
      await exportReportPdf({
        title: 'Observações por Ciclo',
        cycleName: cycle.name,
        subtitle: filtersLabel,
        filename: pdfFilename('observacoes', cycle.name),
        table: {
          head: [['Tipo', 'Avaliador', 'Critério', 'Observação']],
          body,
          columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 35 }, 2: { cellWidth: 40 } },
        },
      })
    } catch (err) {
      setError(`Erro ao gerar PDF: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <Link to="/reports" className="rp-back"><ArrowLeft size={14} /> Reports</Link>
      <div className="rp-header">
        <div>
          <h1 className="page-title">Observações por Ciclo</h1>
          <p className="page-subtitle">Observações submetidas, agrupadas por colaborador avaliado</p>
        </div>
        <button className="rp-btn" onClick={handleExport} disabled={!groups.length || loading || exporting}>
          <FileDown size={14} />
          {exporting ? 'A gerar…' : 'Exportar PDF'}
        </button>
      </div>

      <div className="rp-filters">
        <select className="rp-select" value={cycleId} onChange={e => setCycleId(e.target.value)} disabled={cyclesLoading}>
          <option value="">{cyclesLoading ? 'A carregar ciclos…' : cycles.length ? 'Selecionar ciclo…' : 'Sem ciclos finalizados'}</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="rp-select" value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">Todos os departamentos</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="rp-select" value={type} onChange={e => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(EVALUATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {error && <div className="rp-error">{error}</div>}
      {cycle?.anonymous && (
        <div className="rp-warning">Ciclo anónimo — este report mostra a identidade dos avaliadores.</div>
      )}

      {!cycleId ? (
        <div className="rp-empty">Selecione um ciclo para ver o report.</div>
      ) : loading ? (
        <div className="rp-empty">A carregar…</div>
      ) : items && (
        groups.length === 0 ? (
          <div className="rp-empty">Sem observações {items.length ? 'para os filtros selecionados' : 'registadas neste ciclo'}.</div>
        ) : groups.map(g => (
          <div key={g.id} className="rp-group">
            <div className="rp-group-name">
              {g.name}
              {g.department && <span className="rp-group-dept">{g.department}</span>}
            </div>
            {g.notes.map(n => (
              <div key={n.id} className="rp-obs">
                <div className="rp-obs-meta">
                  {EVALUATION_TYPE_LABELS[n.type] ?? n.type} · {n.evaluator?.full_name ?? '—'}
                </div>
                {observationLines(n).map((l, i) => (
                  <div key={i} className="rp-obs-text">
                    <span className="rp-obs-label">{l.label}: </span>{l.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
