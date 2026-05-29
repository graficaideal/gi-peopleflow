import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ChevronRight, EyeOff, Eye } from 'lucide-react'
import { useEvaluations } from '../hooks/useEvaluations'
import { useCycles } from '../hooks/useCycles'
import { EvaluationTypeBadge, EvaluationStatusBadge } from '../components/evaluations/EvaluationBadge'
import { formatDate } from '../utils/formatters'
import { EVALUATION_TYPE_LABELS } from '../lib/constants'

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

const TYPE_ORDER = { self: 0, peer: 1, manager: 2 }

function buildGroups(filtered, groupBy, getEvaluatee) {
  if (groupBy === 'none') return [{ key: 'all', label: null, items: filtered }]

  const map = {}
  filtered.forEach(ev => {
    let key, label
    if (groupBy === 'employee') {
      const evaluatee = getEvaluatee(ev)
      key   = evaluatee?.id ?? 'unknown'
      label = evaluatee?.full_name ?? '—'
    } else {
      key   = ev.type
      label = EVALUATION_TYPE_LABELS[ev.type] ?? ev.type
    }
    if (!map[key]) map[key] = { key, label, items: [] }
    map[key].items.push(ev)
  })

  return Object.values(map).sort((a, b) =>
    groupBy === 'type'
      ? (TYPE_ORDER[a.key] ?? 99) - (TYPE_ORDER[b.key] ?? 99)
      : a.label.localeCompare(b.label, 'pt')
  )
}

export default function Evaluations() {
  const { evaluations, loading, error } = useEvaluations()
  const { cycles } = useCycles()

  const [cycleFilter, setCycleFilter]   = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hideSubmitted, setHideSubmitted] = useState(
    () => localStorage.getItem('pf_hide_submitted') === 'true'
  )
  const [groupBy, setGroupBy] = useState(
    () => localStorage.getItem('pf_eval_group_by') ?? 'none'
  )

  const toggleHideSubmitted = () => {
    const next = !hideSubmitted
    setHideSubmitted(next)
    localStorage.setItem('pf_hide_submitted', String(next))
  }

  const setGroupByPersisted = (val) => {
    setGroupBy(val)
    localStorage.setItem('pf_eval_group_by', val)
  }

  const isAnonymousPeer = (ev) =>
    ev.type === 'peer' && (Array.isArray(ev.cycle) ? ev.cycle[0] : ev.cycle)?.anonymous

  const getEvaluator = (ev) => {
    const evaluator = Array.isArray(ev.evaluator) ? ev.evaluator[0] : ev.evaluator
    if (isAnonymousPeer(ev)) return 'Anónimo'
    return evaluator?.full_name ?? '—'
  }

  const getEvaluatee = (ev) =>
    Array.isArray(ev.evaluatee) ? ev.evaluatee[0] : ev.evaluatee

  const getCycle = (ev) =>
    Array.isArray(ev.cycle) ? ev.cycle[0] : ev.cycle

  const filtered = useMemo(() => {
    let list = evaluations
    if (cycleFilter !== 'all') list = list.filter(e => e.cycle_id === cycleFilter)
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter)
    if (hideSubmitted) list = list.filter(e => e.status !== 'submitted')
    return list
  }, [evaluations, cycleFilter, typeFilter, statusFilter, hideSubmitted])

  const grouped = useMemo(
    () => buildGroups(filtered, groupBy, getEvaluatee),
    [filtered, groupBy]
  )

  const pending   = useMemo(() => evaluations.filter(e => e.status === 'pending').length, [evaluations])
  const submitted = useMemo(() => evaluations.filter(e => e.status === 'submitted').length, [evaluations])

  const renderRow = (ev, i) => {
    const evaluatee   = getEvaluatee(ev)
    const evaluatorName = getEvaluator(ev)
    const cycle       = getCycle(ev)
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

        /* Group header */
        .evl-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 20px 0 8px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }
        .evl-group-header:first-child { padding-top: 0; }
        .evl-group-sep {
          flex: 1;
          height: 1px;
          background: var(--color-border);
        }
        .evl-group-count {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 7px;
          border-radius: 20px;
          background: var(--color-hover);
          color: var(--color-text-muted);
          letter-spacing: 0;
          text-transform: none;
        }

        /* View controls */
        .evl-view-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }
        .evl-hide-btn {
          height: 30px;
          padding: 0 11px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 500;
          font-family: 'Outfit', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .evl-hide-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .evl-hide-btn.active {
          background: rgba(234,179,8,0.08);
          border-color: rgba(234,179,8,0.3);
          color: #a16207;
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

            {/* View controls — right-aligned */}
            <div className="evl-view-controls">
              <select
                className="evl-cycle-select"
                style={{ height: 30, fontSize: 12 }}
                value={groupBy}
                onChange={e => setGroupByPersisted(e.target.value)}
              >
                <option value="none">Sem agrupamento</option>
                <option value="employee">Por colaborador</option>
                <option value="type">Por tipo</option>
              </select>

              <button
                className={`evl-hide-btn${hideSubmitted ? ' active' : ''}`}
                onClick={toggleHideSubmitted}
              >
                {hideSubmitted ? <Eye size={12} /> : <EyeOff size={12} />}
                {hideSubmitted ? 'Mostrar submetidas' : 'Ocultar submetidas'}
              </button>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {grouped.map(group => (
              <div key={group.key}>
                {group.label !== null && (
                  <div className="evl-group-header">
                    <span>{group.label}</span>
                    <span className="evl-group-count">{group.items.length}</span>
                    <span className="evl-group-sep" />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: group.label !== null ? 4 : 0 }}>
                  {group.items.map((ev, i) => renderRow(ev, i))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
