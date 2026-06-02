import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Search, X, Mail, Link2, MailOpen, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useEvaluations } from '../hooks/useEvaluations'
import { useCycles } from '../hooks/useCycles'
import { EVALUATION_TYPE_LABELS } from '../lib/constants'

const EVAL_BASE_URL = 'https://gi-peopleflow.vercel.app/avaliar'

const STATUS_CFG = {
  pending:   { color: '#8d9190', label: 'Pendente' },
  sent:      { color: '#5b86c5', label: 'Enviada' },
  opened:    { color: '#d97706', label: 'Aberta' },
  submitted: { color: '#16a34a', label: 'Concluída' },
}

const TYPE_CFG = {
  self:    { color: '#6b7fc0', bg: 'rgba(107,127,192,0.1)', label: 'Auto' },
  peer:    { color: '#16a34a', bg: 'rgba(34,197,94,0.1)',   label: 'Colega' },
  manager: { color: '#c2570a', bg: 'rgba(194,87,10,0.1)',   label: 'Chefia' },
}

const TYPE_ORDER = { self: 0, peer: 1, manager: 2 }

const TYPE_FILTERS = [
  { value: 'all',     label: 'Todos' },
  { value: 'self',    label: 'Auto' },
  { value: 'peer',    label: 'Colega' },
  { value: 'manager', label: 'Chefia' },
]

const STATUS_FILTERS = [
  { value: 'all',       label: 'Todos' },
  { value: 'pending',   label: 'Pendentes' },
  { value: 'sent',      label: 'Enviadas' },
  { value: 'opened',    label: 'Abertas' },
  { value: 'submitted', label: 'Concluídas' },
]

export default function Evaluations() {
  const navigate = useNavigate()
  const { evaluations, loading, error } = useEvaluations()
  const { cycles } = useCycles()

  const [cycleFilter, setCycleFilter]   = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [hideSubmitted, setHideSubmitted] = useState(
    () => localStorage.getItem('pf_hide_submitted') === 'true'
  )
  const [groupBy, setGroupBy] = useState(
    () => localStorage.getItem('pf_eval_group_by') ?? 'none'
  )

  const [localChanges, setLocalChanges] = useState({})
  const [copiedId, setCopiedId]         = useState(null)
  const [busyIds, setBusyIds]           = useState(new Set())

  const applyChange = (id, patch) =>
    setLocalChanges(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }))

  const effStatus = (ev) => localChanges[ev.id]?.status ?? ev.status
  const effToken  = (ev) => {
    const ch = localChanges[ev.id]
    return ch && 'token' in ch ? ch.token : ev.token
  }

  const getEvaluatee = (ev) => Array.isArray(ev.evaluatee) ? ev.evaluatee[0] : ev.evaluatee
  const getCycle     = (ev) => Array.isArray(ev.cycle)     ? ev.cycle[0]     : ev.cycle
  const getEvaluator = (ev) => Array.isArray(ev.evaluator) ? ev.evaluator[0] : ev.evaluator
  const getRecipient = (ev) => ev.type === 'self' ? getEvaluatee(ev) : getEvaluator(ev)

  const setBusy = (id, v) => setBusyIds(prev => {
    const next = new Set(prev); v ? next.add(id) : next.delete(id); return next
  })

  const generateToken = async (ev) => {
    const token = crypto.randomUUID()
    const cycle = getCycle(ev)
    const expiresAt = cycle?.end_date
      ? new Date(cycle.end_date + 'T23:59:59').toISOString()
      : null
    setBusy(ev.id, true)
    const { error: err } = await supabase
      .from('pf_evaluations')
      .update({ token, token_expires_at: expiresAt, status: 'sent' })
      .eq('id', ev.id)
    setBusy(ev.id, false)
    if (!err) { applyChange(ev.id, { status: 'sent', token, token_expires_at: expiresAt }); return token }
    return null
  }

  const toggleSent = async (e, ev) => {
    e.stopPropagation()
    const s = effStatus(ev)
    if (s === 'opened' || s === 'submitted' || busyIds.has(ev.id)) return
    if (s === 'pending') {
      await generateToken(ev)
    } else {
      setBusy(ev.id, true)
      const { error: err } = await supabase
        .from('pf_evaluations')
        .update({ token: null, token_expires_at: null, status: 'pending' })
        .eq('id', ev.id)
      setBusy(ev.id, false)
      if (!err) applyChange(ev.id, { status: 'pending', token: null, token_expires_at: null })
    }
  }

  const handleLinkAction = async (e, ev) => {
    e.stopPropagation()
    if (busyIds.has(ev.id)) return
    let token = effToken(ev)
    if (!token) { token = await generateToken(ev); if (!token) return }
    navigator.clipboard.writeText(`${EVAL_BASE_URL}/${token}`)
    setCopiedId(ev.id)
    setTimeout(() => setCopiedId(id => id === ev.id ? null : id), 2000)
  }

  const handleEmailAction = async (e, ev) => {
    e.stopPropagation()
    if (busyIds.has(ev.id)) return
    let token = effToken(ev)
    if (!token) { token = await generateToken(ev); if (!token) return }
    const evaluatee = getEvaluatee(ev)
    const cycle     = getCycle(ev)
    const recipient = getRecipient(ev)
    const link      = `${EVAL_BASE_URL}/${token}`
    const endDate   = cycle?.end_date
      ? new Date(cycle.end_date + 'T00:00:00').toLocaleDateString('pt-PT')
      : '—'
    const subject = encodeURIComponent(`Avaliação de Desempenho - ${evaluatee?.full_name ?? ''}`)
    const body    = encodeURIComponent(
      `Olá ${recipient?.full_name ?? ''},\n\nFoi gerada a sua avaliação de desempenho referente ao ciclo ${cycle?.name ?? ''}. Por favor aceda ao link abaixo para preencher o questionário até ${endDate}.\n\n${link}`
    )
    window.open(`mailto:${recipient?.email ?? ''}?subject=${subject}&body=${body}`)
  }

  const setGroupByPersisted = (val) => { setGroupBy(val); localStorage.setItem('pf_eval_group_by', val) }
  const toggleHideSubmitted = () => {
    const next = !hideSubmitted; setHideSubmitted(next); localStorage.setItem('pf_hide_submitted', String(next))
  }

  const filtered = useMemo(() => {
    let list = evaluations
    if (cycleFilter !== 'all')  list = list.filter(e => e.cycle_id === cycleFilter)
    if (typeFilter !== 'all')   list = list.filter(e => e.type === typeFilter)
    if (statusFilter !== 'all') list = list.filter(e => (localChanges[e.id]?.status ?? e.status) === statusFilter)
    if (hideSubmitted)          list = list.filter(e => (localChanges[e.id]?.status ?? e.status) !== 'submitted')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e => {
        const et = getEvaluatee(e)
        return et?.full_name?.toLowerCase().includes(q) || et?.employee_number?.toLowerCase().includes(q)
      })
    }
    return list
  }, [evaluations, localChanges, cycleFilter, typeFilter, statusFilter, hideSubmitted, search])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, items: filtered }]
    const map = {}
    filtered.forEach(ev => {
      let key, label
      if (groupBy === 'employee') {
        const et = getEvaluatee(ev); key = et?.id ?? 'unknown'; label = et?.full_name ?? '—'
      } else {
        key = ev.type; label = EVALUATION_TYPE_LABELS[ev.type] ?? ev.type
      }
      if (!map[key]) map[key] = { key, label, items: [] }
      map[key].items.push(ev)
    })
    return Object.values(map).sort((a, b) =>
      groupBy === 'type'
        ? (TYPE_ORDER[a.key] ?? 99) - (TYPE_ORDER[b.key] ?? 99)
        : a.label.localeCompare(b.label, 'pt')
    )
  }, [filtered, groupBy])

  const counts = useMemo(() => {
    const c = { pending: 0, sent: 0, opened: 0, submitted: 0 }
    evaluations.forEach(ev => { const s = localChanges[ev.id]?.status ?? ev.status; if (s in c) c[s]++ })
    return c
  }, [evaluations, localChanges])

  const renderRow = (ev, i) => {
    const evaluatee  = getEvaluatee(ev)
    const cycle      = getCycle(ev)
    const es         = effStatus(ev)
    const stCfg      = STATUS_CFG[es] ?? STATUS_CFG.pending
    const tyCfg      = TYPE_CFG[ev.type] ?? TYPE_CFG.self
    const isBusy     = busyIds.has(ev.id)
    const isCopied   = copiedId === ev.id
    const isSent     = es !== 'pending'
    const canToggle  = es === 'pending' || es === 'sent'
    const hasEmail   = !!getRecipient(ev)?.email
    const initials   = (evaluatee?.full_name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

    return (
      <tr
        key={ev.id}
        className="evl-tr"
        onClick={() => navigate(`/evaluations/${ev.id}`)}
        style={{ animationDelay: `${Math.min(i, 40) * 0.012}s` }}
      >
        <td className="evl-td evl-td-name">
          <div className="evl-name-cell">
            <div className="evl-avatar">{initials}</div>
            <div className="evl-name-info">
              <div className="evl-full-name">{evaluatee?.full_name ?? '—'}</div>
              {evaluatee?.employee_number && (
                <div className="evl-emp-num">#{evaluatee.employee_number}</div>
              )}
            </div>
          </div>
        </td>

        <td className="evl-td">
          <span className="evl-type-badge" style={{ background: tyCfg.bg, color: tyCfg.color }}>
            {tyCfg.label}
          </span>
        </td>

        <td className="evl-td evl-td-cycle">
          <span className="evl-cycle-name">{cycle?.name ?? '—'}</span>
        </td>

        <td className="evl-td">
          <span className="evl-status" style={{ '--sc': stCfg.color }}>
            <span className="evl-dot" />
            {stCfg.label}
          </span>
        </td>

        <td className="evl-td evl-td-center" onClick={e => e.stopPropagation()}>
          <button
            className={`evl-sent-btn${isSent ? ' on' : ''}${!canToggle ? ' fixed' : ''}`}
            onClick={(e) => toggleSent(e, ev)}
            disabled={isBusy || !canToggle}
            title={canToggle ? (isSent ? 'Desmarcar como enviada' : 'Marcar como enviada') : undefined}
          >
            <Mail size={13} />
          </button>
        </td>

        <td className="evl-td evl-td-actions" onClick={e => e.stopPropagation()}>
          {hasEmail && (
            <div className="evl-act-wrap">
              <button
                className={`evl-act-btn${isCopied ? ' copied' : ''}`}
                onClick={(e) => handleLinkAction(e, ev)}
                disabled={isBusy}
                title={isCopied ? 'Copiado!' : 'Copiar link de avaliação'}
              >
                <Link2 size={13} />
              </button>
              <button
                className="evl-act-btn"
                onClick={(e) => handleEmailAction(e, ev)}
                disabled={isBusy}
                title="Enviar email com link"
              >
                <MailOpen size={13} />
              </button>
            </div>
          )}
        </td>
      </tr>
    )
  }

  const tableRows = grouped.flatMap(group => {
    const rows = group.items.map((ev, i) => renderRow(ev, i))
    if (group.label === null) return rows
    return [
      <tr key={`g-${group.key}`} className="evl-group-tr">
        <td colSpan={6} className="evl-group-td">
          <span className="evl-group-label">{group.label}</span>
          <span className="evl-group-cnt">{group.items.length}</span>
        </td>
      </tr>,
      ...rows,
    ]
  })

  return (
    <>
      <style>{`
        /* ── Animations ── */
        @keyframes evl-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes evl-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* ── Toolbar ── */
        .evl-toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .evl-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 180px;
          max-width: 260px;
        }
        .evl-search-ico {
          position: absolute;
          left: 10px;
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .evl-search-input {
          width: 100%;
          height: 32px;
          padding: 0 30px 0 32px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 12px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          transition: border-color 0.15s;
        }
        .evl-search-input:focus { border-color: var(--color-accent); }
        .evl-search-input::placeholder { color: var(--color-text-muted); }
        .evl-search-clear {
          position: absolute;
          right: 7px;
          width: 18px; height: 18px;
          border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.12s;
        }
        .evl-search-clear:hover { background: var(--color-hover); }

        .evl-sel {
          height: 32px;
          padding: 0 9px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 12px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          cursor: pointer;
        }
        .evl-sel:focus { border-color: var(--color-accent); }

        .evl-tabs {
          display: flex;
          gap: 2px;
          padding: 2px;
          background: var(--color-hover);
          border-radius: 7px;
        }
        .evl-tab {
          padding: 3px 10px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: background 0.12s, color 0.12s;
          white-space: nowrap;
        }
        .evl-tab:hover { color: var(--color-text); }
        .evl-tab.on {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          font-weight: 600;
        }

        .evl-toolbar-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
        .evl-toggle-btn {
          height: 30px;
          padding: 0 10px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 500;
          font-family: 'Outfit', sans-serif;
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-muted);
          display: inline-flex; align-items: center; gap: 5px;
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
          white-space: nowrap;
        }
        .evl-toggle-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .evl-toggle-btn.on {
          background: rgba(224,203,75,0.08);
          border-color: rgba(224,203,75,0.3);
          color: #a16207;
        }
        [data-theme='dark'] .evl-toggle-btn.on { color: var(--color-accent); }

        /* ── Stats strip ── */
        .evl-stats {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .evl-stat {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 500;
        }
        .evl-stat-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
        .evl-stat-num { font-weight: 700; }
        .evl-stat-lbl { color: var(--color-text-muted); }

        /* ── Table wrap ── */
        .evl-table-wrap {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          animation: evl-in 0.2s ease both;
        }
        .evl-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        /* ── Header ── */
        .evl-thead { position: sticky; top: 0; z-index: 2; }
        .evl-th {
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          padding: 10px 14px 9px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg);
          white-space: nowrap;
        }
        .evl-th-center { text-align: center; }
        .evl-th-r      { text-align: right; }

        /* Column widths */
        .evl-col-name    { width: 30%; }
        .evl-col-type    { width: 90px; }
        .evl-col-cycle   { width: 20%; }
        .evl-col-status  { width: 110px; }
        .evl-col-sent    { width: 72px; }
        .evl-col-actions { width: 72px; }

        /* ── Rows ── */
        .evl-tr {
          cursor: pointer;
          transition: background 0.1s;
          animation: evl-in 0.2s ease both;
        }
        .evl-tr:hover { background: var(--color-hover); }
        .evl-table tbody .evl-tr:not(:last-child) td { border-bottom: 1px solid var(--color-border); }
        .evl-group-tr + .evl-tr td,
        .evl-tr:first-child td { border-top: none; }

        .evl-td {
          padding: 9px 14px;
          vertical-align: middle;
          font-size: 13px;
          color: var(--color-text);
        }
        .evl-td-name  { padding-right: 8px; }
        .evl-td-cycle { padding-left: 8px; padding-right: 8px; }
        .evl-td-center { text-align: center; padding-left: 8px; padding-right: 8px; }
        .evl-td-actions { padding-left: 8px; padding-right: 10px; text-align: right; }

        /* Name cell */
        .evl-name-cell { display: flex; align-items: center; gap: 9px; }
        .evl-avatar {
          width: 28px; height: 28px;
          border-radius: 7px;
          background: rgba(224,203,75,0.12);
          color: #9a8820;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; letter-spacing: 0.3px;
        }
        [data-theme='dark'] .evl-avatar { background: rgba(224,203,75,0.09); color: var(--color-accent); }
        .evl-name-info { min-width: 0; }
        .evl-full-name {
          font-size: 13px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .evl-emp-num { font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }

        /* Type badge */
        .evl-type-badge {
          display: inline-flex; align-items: center;
          padding: 2px 7px; border-radius: 20px;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.3px; text-transform: uppercase;
          white-space: nowrap;
        }

        /* Cycle */
        .evl-cycle-name {
          font-size: 12px; color: var(--color-text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: block; max-width: 100%;
        }

        /* Status */
        .evl-status {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 500;
          color: var(--sc, #8d9190);
        }
        .evl-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--sc, #8d9190); flex-shrink: 0;
        }

        /* Sent toggle */
        .evl-sent-btn {
          width: 28px; height: 28px; border-radius: 7px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          border: 1px solid transparent;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
          opacity: 0.45;
        }
        .evl-sent-btn:hover:not(:disabled):not(.fixed) {
          background: var(--color-hover);
          border-color: var(--color-border);
          opacity: 1;
        }
        .evl-sent-btn.on {
          color: #16a34a;
          opacity: 1;
        }
        .evl-sent-btn.on:hover:not(.fixed) {
          background: rgba(22,163,74,0.08);
          border-color: rgba(22,163,74,0.25);
        }
        .evl-sent-btn.fixed { cursor: default; }
        .evl-sent-btn:disabled { cursor: not-allowed; }

        /* Hover actions */
        .evl-act-wrap {
          display: inline-flex; gap: 3px; justify-content: flex-end;
          opacity: 0; transition: opacity 0.12s;
        }
        .evl-tr:hover .evl-act-wrap { opacity: 1; }
        .evl-act-btn {
          width: 28px; height: 28px; border-radius: 7px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.12s, color 0.12s;
        }
        .evl-act-btn:hover:not(:disabled) { background: var(--color-hover); color: var(--color-text); }
        .evl-act-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .evl-act-btn.copied { color: #16a34a; }

        /* Group rows */
        .evl-group-tr { background: var(--color-bg); }
        .evl-group-td {
          padding: 7px 14px;
          border-bottom: 1px solid var(--color-border);
          border-top: 1px solid var(--color-border);
        }
        .evl-group-td:first-child { border-left: 3px solid var(--color-accent); }
        .evl-group-label {
          font-size: 11px; font-weight: 700;
          color: var(--color-text);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .evl-group-cnt {
          font-size: 10px; font-weight: 600;
          padding: 1px 7px; border-radius: 20px;
          background: rgba(224,203,75,0.15); color: #a16207;
          margin-left: 10px;
        }
        [data-theme='dark'] .evl-group-cnt { background: rgba(224,203,75,0.1); color: var(--color-accent); }

        /* Skeleton */
        .evl-skel-wrap {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px; overflow: hidden;
        }
        .evl-skel-row {
          height: 47px; position: relative; overflow: hidden;
          border-bottom: 1px solid var(--color-border);
        }
        .evl-skel-row:last-child { border-bottom: none; }
        .evl-skel-row::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.025), transparent);
          animation: evl-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .evl-skel-row::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent);
        }

        /* Empty / error */
        .evl-empty {
          padding: 64px 24px; text-align: center;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
        }
        .evl-empty-icon {
          width: 48px; height: 48px; border-radius: 12px;
          background: var(--color-hover);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px; color: var(--color-text-muted);
        }
        .evl-error {
          font-size: 12px; color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12);
          border-radius: 8px; padding: 8px 12px;
        }

        /* Result count */
        .evl-result-count {
          font-size: 11px; color: var(--color-text-muted);
          margin-bottom: 8px; padding-left: 1px;
        }
      `}</style>

      <div>
        {/* Page header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="page-title">Avaliações</h1>
        </div>

        {/* Stats strip */}
        {!loading && evaluations.length > 0 && (
          <div className="evl-stats">
            {Object.entries(STATUS_CFG).map(([key, cfg]) => (
              counts[key] > 0 && (
                <span key={key} className="evl-stat">
                  <span className="evl-stat-dot" style={{ background: cfg.color }} />
                  <span className="evl-stat-num" style={{ color: cfg.color }}>{counts[key]}</span>
                  <span className="evl-stat-lbl">{cfg.label}{counts[key] !== 1 ? 's' : ''}</span>
                </span>
              )
            ))}
            <span className="evl-stat" style={{ marginLeft: 4, color: 'var(--color-text-muted)', fontSize: 11 }}>
              {evaluations.length} total
            </span>
          </div>
        )}

        {/* Toolbar */}
        {!loading && evaluations.length > 0 && (
          <div className="evl-toolbar">
            {/* Search */}
            <div className="evl-search-wrap">
              <Search size={13} className="evl-search-ico" />
              <input
                className="evl-search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar colaborador…"
              />
              {search && (
                <button className="evl-search-clear" onClick={() => setSearch('')}>
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Cycle */}
            <select className="evl-sel" value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}>
              <option value="all">Todos os ciclos</option>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Type tabs */}
            <div className="evl-tabs">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`evl-tab${typeFilter === f.value ? ' on' : ''}`}
                  onClick={() => setTypeFilter(f.value)}
                >{f.label}</button>
              ))}
            </div>

            {/* Status tabs */}
            <div className="evl-tabs">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`evl-tab${statusFilter === f.value ? ' on' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
                >{f.label}</button>
              ))}
            </div>

            {/* Right controls */}
            <div className="evl-toolbar-right">
              <select
                className="evl-sel"
                value={groupBy}
                onChange={e => setGroupByPersisted(e.target.value)}
              >
                <option value="none">Sem agrupamento</option>
                <option value="employee">Por colaborador</option>
                <option value="type">Por tipo</option>
              </select>

              <button
                className={`evl-toggle-btn${hideSubmitted ? ' on' : ''}`}
                onClick={toggleHideSubmitted}
              >
                {hideSubmitted ? <Eye size={11} /> : <EyeOff size={11} />}
                {hideSubmitted ? 'Mostrar concluídas' : 'Ocultar concluídas'}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="evl-skel-wrap">
            {[...Array(8)].map((_, i) => <div key={i} className="evl-skel-row" />)}
          </div>
        ) : error ? (
          <p className="evl-error">{error}</p>
        ) : evaluations.length === 0 ? (
          <div className="evl-empty">
            <div className="evl-empty-icon"><ClipboardList size={20} /></div>
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem avaliações</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              As avaliações são geradas automaticamente ao ativar um ciclo.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="evl-empty">
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem resultados</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tenta ajustar os filtros.</p>
          </div>
        ) : (
          <>
            {(search || cycleFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all') && (
              <div className="evl-result-count">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>
            )}
            <div className="evl-table-wrap">
              <table className="evl-table">
                <colgroup>
                  <col className="evl-col-name" />
                  <col className="evl-col-type" />
                  <col className="evl-col-cycle" />
                  <col className="evl-col-status" />
                  <col className="evl-col-sent" />
                  <col className="evl-col-actions" />
                </colgroup>
                <thead className="evl-thead">
                  <tr>
                    <th className="evl-th">Avaliado</th>
                    <th className="evl-th">Tipo</th>
                    <th className="evl-th">Ciclo</th>
                    <th className="evl-th">Estado</th>
                    <th className="evl-th evl-th-center">Enviado</th>
                    <th className="evl-th evl-th-r" />
                  </tr>
                </thead>
                <tbody>{tableRows}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
