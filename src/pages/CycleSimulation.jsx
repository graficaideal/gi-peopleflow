import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Play, AlertTriangle, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCycles } from '../hooks/useCycles'
import { buildEvaluationPlan } from '../utils/simulateEvaluations'
import { buildRelationLookup } from '../utils/relationLookup'
import { formatEvaluationType } from '../utils/formatters'

const TYPE_ORDER = ['self', 'peer', 'manager', 'general', 'subordinate']
const TIER_LABELS = { team: 'Equipa', department: 'Departamento', relation: 'Relacionamento' }
const REASON_LABELS = {
  no_teammates: 'Sem colegas de equipa',
  all_manager_or_subordinate: 'Só chefia/subordinados na equipa',
  pool_exhausted: 'Pool esgotado mesmo com fallback',
}

const groupLabel = (emp) => emp.team?.name ?? emp.department?.name ?? '—'

export default function CycleSimulation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cycles, loading: cyclesLoading, updateCycle } = useCycles()
  const cycle = cycles.find(c => c.id === id)

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)
  const [confirmActivate, setConfirmActivate] = useState(false)
  const [deptFilter, setDeptFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  const simulate = useCallback(async () => {
    setLoading(true)
    setError('')

    const [empResult, settingResult, evaluator0072Result, teamRelResult, deptRelResult] = await Promise.all([
      supabase.from('pf_employees').select(`
        id, employee_number, full_name, manager_id, department_id, team_id,
        department:pf_departments(name, area),
        team:pf_teams(name)
      `).eq('status', 'active'),
      supabase.from('pf_settings').select('value').eq('key', 'peer_evaluator_limit').single(),
      supabase.from('pf_employees').select('id').eq('employee_number', '0072').maybeSingle(),
      supabase.from('pf_team_relations').select('team_a_id, team_b_id'),
      supabase.from('pf_department_relations').select('department_a_id, department_b_id'),
    ])

    if (empResult.error) {
      setError(empResult.error.message)
      setLoading(false)
      return
    }

    const employees = empResult.data ?? []
    const peerLimit = parseInt(settingResult.data?.value ?? '2', 10)
    const evaluator0072 = evaluator0072Result.data ?? null
    const relationLookup = buildRelationLookup(teamRelResult.data, deptRelResult.data)

    setPlan(buildEvaluationPlan({ employees, peerLimit, relationLookup, evaluator0072 }))
    setLoading(false)
  }, [])

  useEffect(() => { simulate() }, [simulate])

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(TYPE_ORDER.map(t => [t, 0]))
    for (const a of plan?.assignments ?? []) counts[a.type] = (counts[a.type] ?? 0) + 1
    return counts
  }, [plan])

  const noPeer = useMemo(() => plan?.noPeer ?? [], [plan])
  const fallbackRows = useMemo(() => (plan?.peerRows ?? []).filter(r => r.tier !== 'team'), [plan])
  const alertCount = noPeer.length + fallbackRows.length

  const tableRows = useMemo(() => {
    const rows = (plan?.peerRows ?? []).map(r => ({
      key: `${r.evaluatee.id}-${r.evaluator.id}`,
      evaluateeName: r.evaluatee.full_name,
      evaluateeDept: r.evaluatee.department?.name ?? '—',
      evaluateeTeam: groupLabel(r.evaluatee),
      evaluatorName: r.evaluator.full_name,
      evaluatorTeam: groupLabel(r.evaluator),
      tier: r.tier,
    }))
    for (const n of noPeer) {
      rows.push({
        key: `nopeer-${n.evaluatee.id}`,
        evaluateeName: n.evaluatee.full_name,
        evaluateeDept: n.evaluatee.department?.name ?? '—',
        evaluateeTeam: groupLabel(n.evaluatee),
        evaluatorName: '—',
        evaluatorTeam: '—',
        tier: 'none',
      })
    }
    return rows
  }, [plan, noPeer])

  const departmentOptions = useMemo(() =>
    [...new Set(tableRows.map(r => r.evaluateeDept))].sort(), [tableRows])

  const filteredRows = tableRows.filter(r =>
    (!deptFilter || r.evaluateeDept === deptFilter) &&
    (!tierFilter || r.tier === tierFilter)
  )

  const handleActivate = async () => {
    setActivating(true)
    setError('')
    try {
      await updateCycle(id, { status: 'active' })
      navigate('/cycles')
    } catch (err) {
      setError(err.message)
      setActivating(false)
    }
  }

  const requestActivate = () => {
    if (noPeer.length > 0) { setConfirmActivate(true); return }
    handleActivate()
  }

  const initialLoading = cyclesLoading || (loading && !plan)
  const notFound = !cyclesLoading && !cycle

  return (
    <>
      <style>{`
        .sim-back-row { margin-bottom: 14px; }
        .sim-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: var(--color-text-muted);
        }
        .sim-back:hover { color: var(--color-text); }

        .sim-header-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .sim-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

        .sim-btn {
          height: 34px; padding: 0 14px; border-radius: 7px;
          font-size: 13px; font-weight: 600; font-family: 'Outfit', sans-serif;
          cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px;
          transition: opacity 0.15s, background 0.15s;
        }
        .sim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sim-btn-primary { background: var(--color-accent); color: var(--color-primary); }
        .sim-btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .sim-btn-secondary {
          background: transparent; color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .sim-btn-secondary:hover:not(:disabled) { background: var(--color-hover); color: var(--color-text); }

        .sim-spin { animation: sim-spin 0.8s linear infinite; }
        @keyframes sim-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .sim-cards {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px; margin-bottom: 20px;
        }
        .sim-card {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 10px; padding: 14px 16px;
        }
        .sim-card-value { font-size: 22px; font-weight: 700; color: var(--color-text); }
        .sim-card-label { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
        .sim-card-warn { border-color: rgba(234,179,8,0.3); }
        .sim-card-warn .sim-card-value { color: #a16207; }
        .sim-card-alert { border-color: rgba(220,60,60,0.3); }
        .sim-card-alert .sim-card-value { color: #e05252; }

        .sim-error {
          font-size: 12px; color: #e05252; background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12); border-radius: 6px; padding: 7px 11px;
          margin-bottom: 16px;
        }

        .sim-alerts { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .sim-alert-group { border-radius: 10px; padding: 12px 14px; font-size: 12px; }
        .sim-alert-red { background: rgba(220,60,60,0.06); border: 1px solid rgba(220,60,60,0.16); }
        .sim-alert-yellow { background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2); }
        .sim-alert-title {
          display: flex; align-items: center; gap: 6px; font-weight: 600;
          margin-bottom: 8px; color: var(--color-text);
        }
        .sim-alert-row {
          display: flex; justify-content: space-between; gap: 10px;
          padding: 4px 0; color: var(--color-text-muted);
        }
        .sim-alert-reason { font-weight: 600; color: var(--color-text); white-space: nowrap; }

        .sim-table-filters { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .sim-input {
          height: 34px; padding: 0 10px; border: 1px solid var(--color-border);
          border-radius: 7px; background: var(--color-bg); color: var(--color-text);
          font-size: 12px; font-family: 'Outfit', sans-serif; cursor: pointer;
        }

        .sim-table-wrap {
          border: 1px solid var(--color-border); border-radius: 10px;
          overflow-x: auto; background: var(--color-surface);
        }
        .sim-table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
        .sim-table th {
          text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.4px; color: var(--color-text-muted);
          border-bottom: 1px solid var(--color-border);
        }
        .sim-table td {
          padding: 9px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text);
        }
        .sim-table tr:last-child td { border-bottom: none; }
        .sim-table-empty { text-align: center; color: var(--color-text-muted); padding: 24px !important; }

        .sim-skeleton {
          height: 240px; background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 12px;
        }
        .sim-empty { padding: 64px 24px; text-align: center; color: var(--color-text-muted); }

        .sim-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px;
        }
        .sim-modal {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 14px; width: 100%; max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.14);
        }
        .sim-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 0; font-size: 15px; font-weight: 600; color: var(--color-text);
        }
        .sim-modal-close {
          width: 28px; height: 28px; border-radius: 7px; display: flex;
          align-items: center; justify-content: center; color: var(--color-text-muted);
        }
        .sim-modal-close:hover { background: var(--color-hover); }
        .sim-modal-body { padding: 14px 20px 4px; font-size: 13px; color: var(--color-text); line-height: 1.6; }
        .sim-modal-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 16px 20px 20px; margin-top: 14px; border-top: 1px solid var(--color-border);
        }
      `}</style>

      <div>
        <div className="sim-back-row">
          <Link to="/cycles" className="sim-back"><ArrowLeft size={14} /> Ciclos</Link>
        </div>

        {initialLoading ? (
          <div className="sim-skeleton" />
        ) : notFound ? (
          <div className="sim-empty">
            <p>Ciclo não encontrado.</p>
          </div>
        ) : (
          <>
            <div className="sim-header-row">
              <h1 className="page-title">Simulação — {cycle.name}</h1>
              <div className="sim-header-actions">
                <button className="sim-btn sim-btn-secondary" onClick={simulate} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'sim-spin' : ''} /> Simular novamente
                </button>
                <button
                  className="sim-btn sim-btn-primary"
                  onClick={requestActivate}
                  disabled={activating || cycle.status !== 'draft'}
                  title={cycle.status !== 'draft' ? 'Este ciclo já não está em rascunho' : undefined}
                >
                  <Play size={14} /> {activating ? 'A ativar…' : 'Ativar Ciclo'}
                </button>
              </div>
            </div>

            {error && <p className="sim-error">{error}</p>}

            <div className="sim-cards">
              {TYPE_ORDER.map(type => (
                <div key={type} className="sim-card">
                  <div className="sim-card-value">{typeCounts[type]}</div>
                  <div className="sim-card-label">{formatEvaluationType(type)}</div>
                </div>
              ))}
              <div className="sim-card sim-card-warn">
                <div className="sim-card-value">{noPeer.length}</div>
                <div className="sim-card-label">Sem avaliação peer</div>
              </div>
              <div className="sim-card sim-card-warn">
                <div className="sim-card-value">{fallbackRows.length}</div>
                <div className="sim-card-label">Pares fora de equipa</div>
              </div>
              <div className="sim-card sim-card-alert">
                <div className="sim-card-value">{alertCount}</div>
                <div className="sim-card-label">Alertas</div>
              </div>
            </div>

            {alertCount > 0 && (
              <div className="sim-alerts">
                {noPeer.length > 0 && (
                  <div className="sim-alert-group sim-alert-red">
                    <div className="sim-alert-title"><AlertTriangle size={13} /> Sem avaliador peer ({noPeer.length})</div>
                    {noPeer.map(n => (
                      <div key={n.evaluatee.id} className="sim-alert-row">
                        <span>{n.evaluatee.full_name}</span>
                        <span className="sim-alert-reason">{REASON_LABELS[n.reason]}</span>
                      </div>
                    ))}
                  </div>
                )}
                {fallbackRows.length > 0 && (
                  <div className="sim-alert-group sim-alert-yellow">
                    <div className="sim-alert-title"><AlertTriangle size={13} /> Pares com fallback ({fallbackRows.length})</div>
                    {fallbackRows.map(r => (
                      <div key={`${r.evaluatee.id}-${r.evaluator.id}`} className="sim-alert-row">
                        <span>{r.evaluatee.full_name} ↔ {r.evaluator.full_name}</span>
                        <span className="sim-alert-reason">{TIER_LABELS[r.tier]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="sim-table-filters">
              <select className="sim-input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">Todos os departamentos</option>
                {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="sim-input" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                <option value="">Todos os níveis</option>
                <option value="team">Equipa</option>
                <option value="department">Departamento</option>
                <option value="relation">Relacionamento</option>
                <option value="none">Sem par</option>
              </select>
            </div>

            <div className="sim-table-wrap">
              <table className="sim-table">
                <thead>
                  <tr>
                    <th>Avaliado</th>
                    <th>Equipa</th>
                    <th>Avaliador</th>
                    <th>Equipa do Avaliador</th>
                    <th>Nível de fallback</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.key}>
                      <td>{r.evaluateeName}</td>
                      <td>{r.evaluateeTeam}</td>
                      <td>{r.evaluatorName}</td>
                      <td>{r.evaluatorTeam}</td>
                      <td>{r.tier === 'none' ? 'Sem par' : TIER_LABELS[r.tier]}</td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={5} className="sim-table-empty">Sem resultados para este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {confirmActivate && (
        <div className="sim-overlay" onClick={e => e.target === e.currentTarget && setConfirmActivate(false)}>
          <div className="sim-modal">
            <div className="sim-modal-header">
              <span>Ativar mesmo assim?</span>
              <button className="sim-modal-close" onClick={() => setConfirmActivate(false)}><X size={15} /></button>
            </div>
            <div className="sim-modal-body">
              <p>
                {noPeer.length} colaborador{noPeer.length !== 1 ? 'es' : ''} vai{noPeer.length !== 1 ? 'ão' : ''} ficar
                sem avaliação peer neste ciclo. Confirma que quer ativar mesmo assim?
              </p>
            </div>
            <div className="sim-modal-footer">
              <button className="sim-btn sim-btn-secondary" onClick={() => setConfirmActivate(false)}>Cancelar</button>
              <button
                className="sim-btn sim-btn-primary"
                onClick={() => { setConfirmActivate(false); handleActivate() }}
                disabled={activating}
              >
                {activating ? 'A ativar…' : 'Ativar mesmo assim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
