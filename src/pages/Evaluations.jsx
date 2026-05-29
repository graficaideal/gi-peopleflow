import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { useEvaluations } from '../hooks/useEvaluations'
import { useCycles } from '../hooks/useCycles'
import { EvaluationTypeBadge, EvaluationStatusBadge } from '../components/evaluations/EvaluationBadge'
import { formatDate } from '../utils/formatters'

const TYPE_FILTERS = [
  { value: 'all',     label: 'Todos' },
  { value: 'self',    label: 'Autoavaliação' },
  { value: 'peer',    label: 'Colega' },
  { value: 'manager', label: 'Chefia' },
]

const STATUS_FILTERS = [
  { value: 'all',       label: 'Todos' },
  { value: 'pending',   label: 'Pendentes' },
  { value: 'submitted', label: 'Submetidas' },
]

export default function Evaluations() {
  const { evaluations, loading, error } = useEvaluations()
  const { cycles } = useCycles()

  const [cycleFilter, setCycleFilter]   = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = evaluations
    if (cycleFilter !== 'all') list = list.filter(e => e.cycle_id === cycleFilter)
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter)
    return list
  }, [evaluations, cycleFilter, typeFilter, statusFilter])

  const pending   = useMemo(() => evaluations.filter(e => e.status === 'pending').length, [evaluations])
  const submitted = useMemo(() => evaluations.filter(e => e.status === 'submitted').length, [evaluations])

  const isAnonymousPeer = (ev) =>
    ev.type === 'peer' && (Array.isArray(ev.cycle) ? ev.cycle[0] : ev.cycle)?.anonymous

  const getEvaluator = (ev) => {
    const evaluator = Array.isArray(ev.evaluator) ? ev.evaluator[0] : ev.evaluator
    if (isAnonymousPeer(ev)) return 'Anónimo'
    return evaluator?.full_name ?? '—'
  }

  const getEvaluatee = (ev) => {
    const evaluatee = Array.isArray(ev.evaluatee) ? ev.evaluatee[0] : ev.evaluatee
    return evaluatee
  }

  const getCycle = (ev) => {
    return Array.isArray(ev.cycle) ? ev.cycle[0] : ev.cycle
  }

  return (
    <>
      <style>{`
        @keyframes evl-slideIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes evl-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        .evl-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 11px;
          text-decoration: none;
          transition: box-shadow 0.18s, border-color 0.18s;
          animation: evl-slideIn 0.24s ease both;
        }
        .evl-row:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.07);
          border-color: var(--color-accent);
        }

        .evl-main { flex: 1; min-width: 0; }
        .evl-top {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 5px;
        }
        .evl-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.1px;
        }
        .evl-number {
          font-size: 11px;
          color: var(--color-text-muted);
          font-weight: 500;
        }
        .evl-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .evl-meta-sep { opacity: 0.35; }

        .evl-arrow {
          color: var(--color-text-muted);
          flex-shrink: 0;
          transition: color 0.15s, transform 0.15s;
        }
        .evl-row:hover .evl-arrow {
          color: var(--color-accent);
          transform: translateX(2px);
        }

        /* Filter tabs */
        .evl-tabs {
          display: flex;
          gap: 4px;
          padding: 3px;
          background: var(--color-hover);
          border-radius: 8px;
          width: fit-content;
        }
        .evl-tab {
          padding: 4px 11px;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .evl-tab:hover { color: var(--color-text); }
        .evl-tab.active {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .evl-cycle-select {
          height: 34px;
          padding: 0 10px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 12px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .evl-cycle-select:focus { border-color: var(--color-accent); }

        /* Skeleton */
        .evl-skeleton {
          height: 64px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 11px;
          overflow: hidden;
          position: relative;
        }
        .evl-skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent);
          animation: evl-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .evl-skeleton::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
        }

        .evl-empty {
          padding: 64px 24px;
          text-align: center;
          color: var(--color-text-muted);
        }
        .evl-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          background: var(--color-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .evl-error {
          font-size: 12px;
          color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12);
          border-radius: 6px;
          padding: 7px 11px;
        }
      `}</style>

      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
          <div>
            <h1 className="page-title">Avaliações</h1>
            {!loading && (
              <p className="page-subtitle">
                {pending > 0 && <span style={{ color: '#a16207', fontWeight: 600 }}>{pending} pendente{pending !== 1 ? 's' : ''}</span>}
                {pending > 0 && submitted > 0 && <span style={{ opacity: 0.4, margin: '0 6px' }}>·</span>}
                {submitted > 0 && <span>{submitted} submetida{submitted !== 1 ? 's' : ''}</span>}
                {pending === 0 && submitted === 0 && <span>0 avaliações</span>}
              </p>
            )}
          </div>
        </div>

        {/* Filters */}
        {!loading && evaluations.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="evl-cycle-select"
              value={cycleFilter}
              onChange={e => setCycleFilter(e.target.value)}
            >
              <option value="all">Todos os ciclos</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="evl-tabs">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`evl-tab${typeFilter === f.value ? ' active' : ''}`}
                  onClick={() => setTypeFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="evl-tabs">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`evl-tab${statusFilter === f.value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="evl-skeleton" />)}
          </div>
        ) : error ? (
          <p className="evl-error">{error}</p>
        ) : evaluations.length === 0 ? (
          <div className="evl-empty">
            <div className="evl-empty-icon"><ClipboardList size={22} style={{ color: 'var(--color-text-muted)' }} /></div>
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem avaliações</p>
            <p style={{ fontSize: 13 }}>As avaliações são geradas automaticamente ao ativar um ciclo.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="evl-empty">
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem resultados</p>
            <p style={{ fontSize: 13 }}>Tenta ajustar os filtros.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((ev, i) => {
              const evaluatee = getEvaluatee(ev)
              const evaluatorName = getEvaluator(ev)
              const cycle = getCycle(ev)
              return (
                <Link
                  key={ev.id}
                  to={`/evaluations/${ev.id}`}
                  className="evl-row"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="evl-main">
                    <div className="evl-top">
                      <span className="evl-name">{evaluatee?.full_name ?? '—'}</span>
                      {evaluatee?.employee_number && (
                        <span className="evl-number">#{evaluatee.employee_number}</span>
                      )}
                      <EvaluationTypeBadge type={ev.type} />
                      <EvaluationStatusBadge status={ev.status} />
                    </div>
                    <div className="evl-meta">
                      <span>Avaliador: {evaluatorName}</span>
                      {cycle?.name && (
                        <>
                          <span className="evl-meta-sep">·</span>
                          <span>{cycle.name}</span>
                        </>
                      )}
                      {ev.status === 'submitted' && ev.submitted_at && (
                        <>
                          <span className="evl-meta-sep">·</span>
                          <span>Submetida em {formatDate(ev.submitted_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="evl-arrow" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
