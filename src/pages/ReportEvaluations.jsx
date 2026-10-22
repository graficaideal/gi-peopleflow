import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileDown } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCycles } from '../hooks/useCycles'
import { EVALUATION_TYPES, EVALUATION_TYPE_SHORT_LABELS } from '../lib/constants'
import { buildEvaluationReport, fetchAll, formatAvg } from '../utils/reports'
import { exportReportPdf, pdfFilename } from '../utils/reportPdf'

const TYPE_ORDER = Object.values(EVALUATION_TYPES)
const REPORT_STATUSES = ['active', 'medical_leave']

export default function ReportEvaluations() {
  const { cycles, loading: cyclesLoading } = useCycles()
  const [cycleId, setCycleId]   = useState('')
  const [report, setReport]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [exporting, setExporting] = useState(false)

  const cycle = cycles.find(c => c.id === cycleId)

  useEffect(() => {
    if (!cycleId) { setReport(null); return }
    let stale = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchAll(() => supabase
        .from('pf_employees')
        .select('id, employee_number, full_name, department:pf_departments(name), team:pf_teams(name)')
        .in('status', REPORT_STATUSES)
        .order('id')),
      fetchAll(() => supabase
        .from('pf_evaluations')
        .select('id, evaluatee_id, type, status, answers:pf_evaluation_answers(score)')
        .eq('cycle_id', cycleId)
        .neq('status', 'cancelled')
        .order('id')),
    ])
      .then(([employees, evaluations]) => {
        if (!stale) setReport(buildEvaluationReport(employees, evaluations, TYPE_ORDER))
      })
      .catch(err => { if (!stale) { setError(err.message); setReport(null) } })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [cycleId])

  const columns = useMemo(() => [
    'Nº', 'Nome', 'Departamento', 'Equipa', 'Média Global',
    ...(report?.types ?? []).map(t => EVALUATION_TYPE_SHORT_LABELS[t]),
  ], [report])

  const footerLabel = report && `Média geral · ${report.footer.evaluated} de ${report.rows.length} colaboradores avaliados`

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      await exportReportPdf({
        title: 'Avaliações por Ciclo',
        cycleName: cycle.name,
        filename: pdfFilename('avaliacoes', cycle.name),
        orientation: 'landscape',
        table: {
          head: [columns],
          body: report.rows.map(r => [
            r.employee.employee_number ?? '',
            r.employee.full_name,
            r.department ?? '-',
            r.team ?? '-',
            formatAvg(r.global, '-'),
            ...report.types.map(t => formatAvg(r.byType[t], '-')),
          ]),
          foot: [[
            { content: footerLabel, colSpan: 4 },
            formatAvg(report.footer.global, '-'),
            ...report.types.map(t => formatAvg(report.footer.byType[t], '-')),
          ]],
          columnStyles: Object.fromEntries(
            columns.map((_, i) => [i, i >= 4 ? { halign: 'right', cellWidth: 22 } : {}])
          ),
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
          <h1 className="page-title">Avaliações por Ciclo</h1>
          <p className="page-subtitle">Médias por colaborador e por tipo de avaliação</p>
        </div>
        <button className="rp-btn" onClick={handleExport} disabled={!report || loading || exporting}>
          <FileDown size={14} />
          {exporting ? 'A gerar…' : 'Exportar PDF'}
        </button>
      </div>

      <div className="rp-filters">
        <select className="rp-select" value={cycleId} onChange={e => setCycleId(e.target.value)} disabled={cyclesLoading}>
          <option value="">{cyclesLoading ? 'A carregar ciclos…' : 'Selecionar ciclo…'}</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div className="rp-error">{error}</div>}

      {!cycleId ? (
        <div className="rp-empty">Selecione um ciclo para ver o report.</div>
      ) : loading ? (
        <div className="rp-empty">A carregar…</div>
      ) : report && (
        report.rows.length === 0 ? (
          <div className="rp-empty">Sem colaboradores ativos.</div>
        ) : (
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>{columns.map((c, i) => <th key={c} className={i >= 4 ? 'rp-num' : undefined}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {report.rows.map(r => (
                  <tr key={r.employee.id}>
                    <td>{r.employee.employee_number}</td>
                    <td>{r.employee.full_name}</td>
                    <td>{r.department ?? '—'}</td>
                    <td>{r.team ?? '—'}</td>
                    <td className="rp-num" style={{ fontWeight: 600 }}>{formatAvg(r.global)}</td>
                    {report.types.map(t => <td key={t} className="rp-num">{formatAvg(r.byType[t])}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>{footerLabel}</td>
                  <td className="rp-num">{formatAvg(report.footer.global)}</td>
                  {report.types.map(t => <td key={t} className="rp-num">{formatAvg(report.footer.byType[t])}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  )
}
