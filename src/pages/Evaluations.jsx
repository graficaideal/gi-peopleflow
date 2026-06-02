import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Search, X, Mail, Link2, MailOpen, Eye, EyeOff, List, Users, Tag } from 'lucide-react'
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
  cancelled: { color: '#c05252', label: 'Cancelada' },
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
  { value: 'cancelled', label: 'Canceladas' },
]

const GROUPBY_OPTIONS = [
  { value: 'none',     icon: List,  label: 'Lista' },
  { value: 'employee', icon: Users, label: 'Colaborador' },
  { value: 'type',     icon: Tag,   label: 'Tipo' },
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
  const [sentConfirmEv, setSentConfirmEv] = useState(null)

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

  const generateToken = async (ev, markSent = true) => {
    const token = crypto.randomUUID()
    const cycle = getCycle(ev)
    const expiresAt = cycle?.end_date
      ? new Date(cycle.end_date + 'T23:59:59').toISOString()
      : null
    const patch = markSent
      ? { token, token_expires_at: expiresAt, status: 'sent' }
      : { token, token_expires_at: expiresAt }
    setBusy(ev.id, true)
    const { error: err } = await supabase
      .from('pf_evaluations')
      .update(patch)
      .eq('id', ev.id)
    setBusy(ev.id, false)
    if (!err) { applyChange(ev.id, patch); return token }
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

  const handleLinkAction = (e, ev) => {
    e.stopPropagation()
    const token = effToken(ev)
    if (!token) return
    navigator.clipboard.writeText(`${EVAL_BASE_URL}/${token}`)
    setCopiedId(ev.id)
    setTimeout(() => setCopiedId(id => id === ev.id ? null : id), 2000)
  }

  const handleEmailAction = async (e, ev) => {
    e.stopPropagation()
    if (busyIds.has(ev.id)) return
    let token = effToken(ev)
    if (!token) { token = await generateToken(ev, false); if (!token) return }
    const evaluatee = getEvaluatee(ev)
    const evaluator = getEvaluator(ev)
    const cycle     = getCycle(ev)
    const recipient = getRecipient(ev)
    const link      = `${EVAL_BASE_URL}/${token}`
    const endDate   = cycle?.end_date
      ? new Date(cycle.end_date + 'T00:00:00').toLocaleDateString('pt-PT')
      : '—'
    const cycleName = cycle?.name ?? ''

    let subject, bodyText
    if (ev.type === 'self') {
      subject  = `Avaliação de Desempenho - A sua autoavaliação`
      bodyText = `Olá ${evaluatee?.full_name ?? ''},\n\nEstá disponível a sua autoavaliação de desempenho referente ao ciclo ${cycleName}. Por favor aceda ao link abaixo para preencher o questionário até ${endDate}.\n\n${link}`
    } else if (ev.type === 'peer') {
      subject  = `Avaliação de Desempenho - Avaliação de colega`
      bodyText = `Olá ${evaluator?.full_name ?? ''},\n\nFoi-lhe atribuída a avaliação de desempenho do/a ${evaluatee?.full_name ?? ''} referente ao ciclo ${cycleName}. Por favor aceda ao link abaixo para preencher o questionário até ${endDate}.\n\n${link}`
    } else {
      subject  = `Avaliação de Desempenho - Avaliação da sua equipa`
      bodyText = `Olá ${evaluator?.full_name ?? ''},\n\nFoi-lhe atribuída a avaliação de desempenho do/a ${evaluatee?.full_name ?? ''} referente ao ciclo ${cycleName}. Por favor aceda ao link abaixo para preencher o questionário até ${endDate}.\n\n${link}`
    }

    window.open(`mailto:${recipient?.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`)
    setSentConfirmEv(ev)
  }

  const handleConfirmSent = async () => {
    const ev = sentConfirmEv
    setSentConfirmEv(null)
    if (!ev) return
    const s = effStatus(ev)
    if (s === 'sent' || s === 'opened' || s === 'submitted') return
    setBusy(ev.id, true)
    const { error: err } = await supabase
      .from('pf_evaluations')
      .update({ status: 'sent' })
      .eq('id', ev.id)
    setBusy(ev.id, false)
    if (!err) applyChange(ev.id, { status: 'sent' })
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
    if (hideSubmitted)          list = list.filter(e => {
      const s = localChanges[e.id]?.status ?? e.status
      return s !== 'submitted' && s !== 'cancelled'
    })
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e => {
        const et = getEvaluatee(e)
        return et?.full_name?.toLowerCase().includes(q) || et?.employee_number?.toLowerCase().includes(q)
      })
    }
    return list.slice().sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99))
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
    const c = { pending: 0, sent: 0, opened: 0, submitted: 0, cancelled: 0 }
    evaluations.forEach(ev => { const s = localChanges[ev.id]?.status ?? ev.status; if (s in c) c[s]++ })
    return c
  }, [evaluations, localChanges])

  // Number of columns depends on groupBy (name col hidden in 'employee', type col hidden in 'employee'+'type')
  const colSpan = groupBy === 'none' ? 6 : 5

  const renderRow = (ev, i) => {
    const evaluatee  = getEvaluatee(ev)
    const evaluator  = getEvaluator(ev)
    const cycle      = getCycle(ev)
    const es         = effStatus(ev)
    const stCfg      = STATUS_CFG[es] ?? STATUS_CFG.pending
    const tyCfg      = TYPE_CFG[ev.type] ?? TYPE_CFG.self
    const isBusy     = busyIds.has(ev.id)
    const isCopied   = copiedId === ev.id
    const isSent     = es !== 'pending'
    const canToggle  = es === 'pending' || es === 'sent'
    const isCompleted  = es === 'submitted'
    const isCancelled  = es === 'cancelled'
    const hasEmail   = !!getRecipient(ev)?.email
    const initials   = (evaluatee?.full_name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    const evalName   = evaluator?.full_name ?? null

    return (
      <tr
        key={ev.id}
        className={`evl-tr${isCompleted ? ' evl-tr-done' : ''}${isCancelled ? ' evl-tr-cancelled' : ''}`}
        onClick={() => navigate(`/evaluations/${ev.id}`)}
        style={{ animationDelay: `${Math.min(i, 40) * 0.012}s` }}
      >
        {/* Col 1: context-aware */}
        {groupBy === 'employee' ? (
          <td className="evl-td">
            <div className="evl-type-main">
              <span className="evl-type-badge" style={{ background: tyCfg.bg, color: tyCfg.color }}>
                {tyCfg.label}
              </span>
              {ev.type !== 'self' && evalName && (
                <span className="evl-eval-hint">{evalName}</span>
              )}
            </div>
          </td>
        ) : (
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
        )}

        {/* Col 2: type badge — only in 'none' grouping */}
        {groupBy === 'none' && (
          <td className="evl-td">
            <span className="evl-type-badge" style={{ background: tyCfg.bg, color: tyCfg.color }}>
              {tyCfg.label}
            </span>
          </td>
        )}

        {/* Cycle */}
        <td className="evl-td evl-td-cycle">
          <span className="evl-cycle-name">{cycle?.name ?? '—'}</span>
        </td>

        {/* Status */}
        <td className="evl-td">
          <span className="evl-status" style={{ '--sc': stCfg.color }}>
            <span className="evl-dot" />
            {stCfg.label}
          </span>
        </td>

        {/* Sent toggle */}
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

        {/* Actions */}
        <td className="evl-td evl-td-actions" onClick={e => e.stopPropagation()}>
          {hasEmail && (
            <div className="evl-act-wrap">
              <button
                className={`evl-act-btn${isCopied ? ' copied' : ''}`}
                onClick={(e) => handleLinkAction(e, ev)}
                disabled={!effToken(ev)}
                title={effToken(ev) ? (isCopied ? 'Copiado!' : 'Copiar link') : 'Gera um link primeiro'}
              >
                <Link2 size={13} />
              </button>
              <button
                className="evl-act-btn"
                onClick={(e) => handleEmailAction(e, ev)}
                disabled={isBusy}
                title="Enviar email"
              >
                <MailOpen size={13} />
              </button>
            </div>
          )}
        </td>
      </tr>
    )
  }

  const renderGroupHeader = (group) => {
    if (group.label === null) return null

    if (groupBy === 'employee') {
      // Rich header: avatar + name + number + per-type status summary
      const sample     = getEvaluatee(group.items[0])
      const empNum     = sample?.employee_number
      const initials   = group.label.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
      const summary    = group.items
        .slice()
        .sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99))
        .map(ev => ({
          type: ev.type,
          tc:   TYPE_CFG[ev.type]   ?? TYPE_CFG.self,
          sc:   STATUS_CFG[effStatus(ev)] ?? STATUS_CFG.pending,
        }))

      return (
        <tr key={`g-${group.key}`} className="evl-group-tr evl-group-tr-emp">
          <td colSpan={colSpan} className="evl-group-td">
            <div className="evl-group-emp-row">
              <div className="evl-group-avatar">{initials}</div>
              <div className="evl-group-info">
                <span className="evl-group-name">{group.label}</span>
                {empNum && <span className="evl-group-empnum">#{empNum}</span>}
              </div>
              <div className="evl-group-summary">
                {summary.map(s => (
                  <span key={s.type} className="evl-gs-pill">
                    <span className="evl-gs-dot" style={{ background: s.sc.color }} title={s.sc.label} />
                    <span style={{ color: s.tc.color }}>{s.tc.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )
    }

    // Type grouping: simple label + count
    return (
      <tr key={`g-${group.key}`} className="evl-group-tr">
        <td colSpan={colSpan} className="evl-group-td">
          {groupBy === 'type' && (
            <span
              className="evl-type-badge evl-group-type-badge"
              style={{ background: TYPE_CFG[group.key]?.bg ?? 'var(--color-hover)', color: TYPE_CFG[group.key]?.color ?? 'var(--color-text)' }}
            >
              {group.label}
            </span>
          )}
          {groupBy !== 'type' && <span className="evl-group-label">{group.label}</span>}
          <span className="evl-group-cnt">{group.items.length}</span>
        </td>
      </tr>
    )
  }

  const tableRows = grouped.flatMap(group => [
    ...(group.label !== null ? [renderGroupHeader(group)] : []),
    ...group.items.map((ev, i) => renderRow(ev, i)),
  ])

  return (
    <>
      <style>{`
        @keyframes evl-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes evl-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* ── Header + stats ── */
        .evl-page-header {
          display: flex;
          align-items: baseline;
          gap: 16px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .evl-stats {
          display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
          margin-left: auto;
        }
        .evl-stat {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 500;
          cursor: pointer;
          padding: 2px 6px; border-radius: 5px;
          transition: background 0.12s;
        }
        .evl-stat:hover { background: var(--color-hover); }
        .evl-stat.active-filter { background: var(--color-hover); }
        .evl-stat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .evl-stat-num { font-weight: 700; }
        .evl-stat-lbl { color: var(--color-text-muted); }

        /* ── Toolbar row 1: filters ── */
        .evl-filters {
          display: flex; gap: 7px; align-items: center;
          flex-wrap: wrap; margin-bottom: 8px;
        }
        .evl-search-wrap {
          position: relative; display: flex; align-items: center;
          min-width: 180px; max-width: 240px; flex: 1;
        }
        .evl-search-ico {
          position: absolute; left: 9px;
          color: var(--color-text-muted); pointer-events: none;
        }
        .evl-search-input {
          width: 100%; height: 30px;
          padding: 0 28px 0 30px;
          border: 1px solid var(--color-border);
          border-radius: 7px;
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 12px; font-family: 'Outfit', sans-serif;
          outline: none; transition: border-color 0.15s;
        }
        .evl-search-input:focus { border-color: var(--color-accent); }
        .evl-search-input::placeholder { color: var(--color-text-muted); }
        .evl-search-clear {
          position: absolute; right: 7px;
          width: 16px; height: 16px; border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted); transition: background 0.12s;
        }
        .evl-search-clear:hover { background: var(--color-hover); }
        .evl-sel {
          height: 30px; padding: 0 8px;
          border: 1px solid var(--color-border); border-radius: 7px;
          background: var(--color-surface); color: var(--color-text);
          font-size: 12px; font-family: 'Outfit', sans-serif;
          outline: none; cursor: pointer; max-width: 160px;
        }
        .evl-sel:focus { border-color: var(--color-accent); }
        .evl-tabs {
          display: flex; gap: 1px; padding: 2px;
          background: var(--color-hover); border-radius: 7px;
        }
        .evl-tab {
          padding: 3px 9px; border-radius: 5px;
          font-size: 11px; font-weight: 500;
          color: var(--color-text-muted);
          transition: background 0.12s, color 0.12s; white-space: nowrap;
        }
        .evl-tab:hover { color: var(--color-text); }
        .evl-tab.on {
          background: var(--color-surface); color: var(--color-text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08); font-weight: 600;
        }

        /* ── Toolbar row 2: view controls ── */
        .evl-viewbar {
          display: flex; gap: 6px; align-items: center;
          margin-bottom: 12px; flex-wrap: wrap;
        }
        .evl-groupby-label {
          font-size: 11px; color: var(--color-text-muted);
          margin-right: 2px; flex-shrink: 0;
        }
        .evl-groupby-btns {
          display: flex; gap: 2px; padding: 2px;
          background: var(--color-hover); border-radius: 7px;
        }
        .evl-groupby-btn {
          padding: 3px 10px; border-radius: 5px;
          font-size: 11px; font-weight: 500;
          color: var(--color-text-muted);
          display: inline-flex; align-items: center; gap: 4px;
          transition: background 0.12s, color 0.12s; white-space: nowrap;
        }
        .evl-groupby-btn:hover { color: var(--color-text); }
        .evl-groupby-btn.on {
          background: var(--color-surface); color: var(--color-text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08); font-weight: 600;
        }
        .evl-viewbar-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
        .evl-toggle-btn {
          height: 28px; padding: 0 9px; border-radius: 7px;
          font-size: 11px; font-weight: 500; font-family: 'Outfit', sans-serif;
          border: 1px solid var(--color-border); background: transparent;
          color: var(--color-text-muted);
          display: inline-flex; align-items: center; gap: 5px;
          cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
          white-space: nowrap;
        }
        .evl-toggle-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .evl-toggle-btn.on {
          background: rgba(224,203,75,0.08); border-color: rgba(224,203,75,0.3); color: #a16207;
        }
        [data-theme='dark'] .evl-toggle-btn.on { color: var(--color-accent); }

        /* ── Table ── */
        .evl-table-wrap {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px; overflow: hidden;
          animation: evl-in 0.2s ease both;
        }
        .evl-table { width: 100%; border-collapse: collapse; }
        .evl-thead { position: sticky; top: 0; z-index: 2; }
        .evl-th {
          text-align: left; font-size: 10px; font-weight: 700;
          color: var(--color-text-muted); text-transform: uppercase;
          letter-spacing: 0.7px; padding: 9px 14px 8px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg); white-space: nowrap;
        }
        .evl-th-center { text-align: center; }
        .evl-th-r      { text-align: right; }

        /* ── Rows ── */
        .evl-tr {
          cursor: pointer; transition: background 0.1s;
          animation: evl-in 0.2s ease both;
        }
        .evl-tr:hover { background: var(--color-hover); }
        .evl-tr-done { opacity: 0.62; }
        .evl-tr-done:hover { opacity: 1; }
        .evl-tr-cancelled { opacity: 0.45; }
        .evl-tr-cancelled:hover { opacity: 0.8; }
        .evl-table tbody .evl-tr:not(:last-child) td,
        .evl-table tbody .evl-tr:not(:last-child) th {
          border-bottom: 1px solid var(--color-border);
        }

        .evl-td { padding: 8px 14px; vertical-align: middle; font-size: 13px; color: var(--color-text); }
        .evl-td-name   { padding-right: 8px; }
        .evl-td-cycle  { padding-left: 8px; padding-right: 8px; max-width: 0; }
        .evl-td-center { text-align: center; padding-left: 8px; padding-right: 8px; }
        .evl-td-actions { padding-left: 8px; padding-right: 10px; text-align: right; }

        /* Name cell */
        .evl-name-cell { display: flex; align-items: center; gap: 9px; }
        .evl-avatar {
          width: 28px; height: 28px; border-radius: 7px;
          background: rgba(224,203,75,0.12); color: #9a8820;
          font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        [data-theme='dark'] .evl-avatar { background: rgba(224,203,75,0.09); color: var(--color-accent); }
        .evl-name-info { min-width: 0; }
        .evl-full-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .evl-emp-num   { font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }

        /* Type-primary cell (in employee grouping) */
        .evl-type-main { display: flex; align-items: center; gap: 8px; }
        .evl-eval-hint { font-size: 11px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Type badge */
        .evl-type-badge {
          display: inline-flex; align-items: center;
          padding: 2px 7px; border-radius: 20px;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.3px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
        }

        /* Cycle */
        .evl-cycle-name {
          font-size: 12px; color: var(--color-text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;
        }

        /* Status */
        .evl-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: var(--sc, #8d9190); }
        .evl-dot    { width: 6px; height: 6px; border-radius: 50%; background: var(--sc, #8d9190); flex-shrink: 0; }

        /* Sent button */
        .evl-sent-btn {
          width: 28px; height: 28px; border-radius: 7px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-text-muted); border: 1px solid transparent;
          transition: color 0.15s, background 0.15s, border-color 0.15s; opacity: 0.4;
        }
        .evl-sent-btn:hover:not(:disabled):not(.fixed) {
          background: var(--color-hover); border-color: var(--color-border); opacity: 1;
        }
        .evl-sent-btn.on { color: #16a34a; opacity: 1; }
        .evl-sent-btn.on:hover:not(.fixed) { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.25); }
        .evl-sent-btn.fixed { cursor: default; }
        .evl-sent-btn:disabled { cursor: not-allowed; }

        /* Action icons */
        .evl-act-wrap { display: inline-flex; gap: 2px; justify-content: flex-end; opacity: 0; transition: opacity 0.12s; }
        .evl-tr:hover .evl-act-wrap { opacity: 1; }
        .evl-act-btn {
          width: 27px; height: 27px; border-radius: 7px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-text-muted); transition: background 0.12s, color 0.12s;
        }
        .evl-act-btn:hover:not(:disabled) { background: var(--color-hover); color: var(--color-text); }
        .evl-act-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .evl-act-btn.copied { color: #16a34a; }

        /* ── Group rows ── */
        .evl-group-tr { background: var(--color-bg); }
        .evl-group-td {
          padding: 0;
          border-bottom: 1px solid var(--color-border);
          border-top: 2px solid var(--color-border);
        }
        /* First group header: no top border */
        .evl-table tbody tr:first-child.evl-group-tr .evl-group-td { border-top: none; }

        /* Simple group header (type grouping) */
        .evl-group-tr:not(.evl-group-tr-emp) .evl-group-td {
          padding: 7px 14px; border-left: 3px solid var(--color-accent);
        }
        .evl-group-label { font-size: 11px; font-weight: 700; color: var(--color-text); text-transform: uppercase; letter-spacing: 0.5px; }
        .evl-group-type-badge { font-size: 11px !important; padding: 3px 9px !important; }
        .evl-group-cnt {
          font-size: 10px; font-weight: 600;
          padding: 1px 7px; border-radius: 20px;
          background: rgba(224,203,75,0.15); color: #a16207; margin-left: 10px;
        }
        [data-theme='dark'] .evl-group-cnt { background: rgba(224,203,75,0.1); color: var(--color-accent); }

        /* Rich employee group header */
        .evl-group-tr-emp .evl-group-td { padding: 10px 14px; border-left: 3px solid var(--color-accent); }
        .evl-group-emp-row { display: flex; align-items: center; gap: 10px; }
        .evl-group-avatar {
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
          background: rgba(224,203,75,0.14); color: #9a8820;
          font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
          display: flex; align-items: center; justify-content: center;
        }
        [data-theme='dark'] .evl-group-avatar { background: rgba(224,203,75,0.1); color: var(--color-accent); }
        .evl-group-info { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
        .evl-group-name { font-size: 13px; font-weight: 700; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .evl-group-empnum { font-size: 10px; color: var(--color-text-muted); flex-shrink: 0; }
        .evl-group-summary { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-shrink: 0; }
        .evl-gs-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; }
        .evl-gs-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ── Skeleton ── */
        .evl-skel-wrap { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; }
        .evl-skel-row { height: 44px; position: relative; overflow: hidden; border-bottom: 1px solid var(--color-border); }
        .evl-skel-row:last-child { border-bottom: none; }
        .evl-skel-row::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.025), transparent);
          animation: evl-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .evl-skel-row::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent);
        }

        /* ── Empty / error ── */
        .evl-empty {
          padding: 56px 24px; text-align: center;
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;
        }
        .evl-empty-icon {
          width: 46px; height: 46px; border-radius: 11px; background: var(--color-hover);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px; color: var(--color-text-muted);
        }
        .evl-error {
          font-size: 12px; color: #e05252;
          background: rgba(220,60,60,0.06); border: 1px solid rgba(220,60,60,0.12);
          border-radius: 8px; padding: 8px 12px;
        }
        .evl-result-count { font-size: 11px; color: var(--color-text-muted); margin-bottom: 7px; padding-left: 1px; }

        /* ── Sent confirm modal ── */
        .evl-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 500; padding: 24px;
        }
        .evl-confirm-modal {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          width: 100%; max-width: 360px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          animation: evl-in 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        .evl-confirm-body { padding: 22px 22px 18px; }
        .evl-confirm-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(22,163,74,0.1); color: #16a34a;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .evl-confirm-title { font-size: 14px; font-weight: 700; color: var(--color-text); letter-spacing: -0.1px; margin-bottom: 6px; }
        .evl-confirm-desc  { font-size: 13px; color: var(--color-text-muted); line-height: 1.55; }
        .evl-confirm-footer { display: flex; gap: 8px; padding: 0 22px 20px; }
        .evl-confirm-btn {
          flex: 1; height: 36px; border-radius: 8px;
          font-size: 13px; font-weight: 600; font-family: 'Outfit', sans-serif;
          cursor: pointer; transition: opacity 0.15s, background 0.15s;
        }
        .evl-confirm-btn-yes { background: rgba(22,163,74,0.1); color: #16a34a; border: 1px solid rgba(22,163,74,0.25); }
        .evl-confirm-btn-yes:hover { background: rgba(22,163,74,0.18); }
        .evl-confirm-btn-no  { background: transparent; color: var(--color-text-muted); border: 1px solid var(--color-border); }
        .evl-confirm-btn-no:hover  { background: var(--color-hover); color: var(--color-text); }
      `}</style>

      <div>
        {/* Page header + stats */}
        <div className="evl-page-header">
          <h1 className="page-title" style={{ marginBottom: 0 }}>Avaliações</h1>
          {!loading && evaluations.length > 0 && (
            <div className="evl-stats">
              {Object.entries(STATUS_CFG).map(([key, cfg]) =>
                counts[key] > 0 ? (
                  <button
                    key={key}
                    className={`evl-stat${statusFilter === key ? ' active-filter' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                  >
                    <span className="evl-stat-dot" style={{ background: cfg.color }} />
                    <span className="evl-stat-num" style={{ color: cfg.color }}>{counts[key]}</span>
                    <span className="evl-stat-lbl">{cfg.label}{counts[key] !== 1 ? 's' : ''}</span>
                  </button>
                ) : null
              )}
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 4 }}>
                {evaluations.length} total
              </span>
            </div>
          )}
        </div>

        {!loading && evaluations.length > 0 && (<>
          {/* Row 1: Filters */}
          <div className="evl-filters">
            <div className="evl-search-wrap">
              <Search size={12} className="evl-search-ico" />
              <input
                className="evl-search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar colaborador…"
              />
              {search && (
                <button className="evl-search-clear" onClick={() => setSearch('')}>
                  <X size={10} />
                </button>
              )}
            </div>
            <select className="evl-sel" value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}>
              <option value="all">Todos os ciclos</option>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="evl-tabs">
              {TYPE_FILTERS.map(f => (
                <button key={f.value} className={`evl-tab${typeFilter === f.value ? ' on' : ''}`} onClick={() => setTypeFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="evl-tabs">
              {STATUS_FILTERS.map(f => (
                <button key={f.value} className={`evl-tab${statusFilter === f.value ? ' on' : ''}`} onClick={() => setStatusFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: View controls */}
          <div className="evl-viewbar">
            <span className="evl-groupby-label">Agrupar:</span>
            <div className="evl-groupby-btns">
              {GROUPBY_OPTIONS.map(opt => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    className={`evl-groupby-btn${groupBy === opt.value ? ' on' : ''}`}
                    onClick={() => setGroupByPersisted(opt.value)}
                  >
                    <Icon size={10} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <div className="evl-viewbar-right">
              <button className={`evl-toggle-btn${hideSubmitted ? ' on' : ''}`} onClick={toggleHideSubmitted}>
                {hideSubmitted ? <Eye size={10} /> : <EyeOff size={10} />}
                {hideSubmitted ? 'Mostrar finalizados' : 'Ocultar finalizados'}
              </button>
            </div>
          </div>
        </>)}

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
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>As avaliações são geradas automaticamente ao ativar um ciclo.</p>
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
                <thead className="evl-thead">
                  <tr>
                    <th className="evl-th" style={{ width: groupBy === 'none' ? '30%' : '26%' }}>
                      {groupBy === 'employee' ? 'Tipo / Avaliador' : 'Avaliado'}
                    </th>
                    {groupBy === 'none' && (
                      <th className="evl-th" style={{ width: 88 }}>Tipo</th>
                    )}
                    <th className="evl-th">Ciclo</th>
                    <th className="evl-th" style={{ width: 108 }}>Estado</th>
                    <th className="evl-th evl-th-center" style={{ width: 70 }}>Enviado</th>
                    <th className="evl-th evl-th-r"     style={{ width: 70 }} />
                  </tr>
                </thead>
                <tbody>{tableRows}</tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Sent confirmation modal ── */}
      {sentConfirmEv && (
        <div className="evl-overlay" onClick={e => e.target === e.currentTarget && setSentConfirmEv(null)}>
          <div className="evl-confirm-modal">
            <div className="evl-confirm-body">
              <div className="evl-confirm-icon">
                <Mail size={18} />
              </div>
              <div className="evl-confirm-title">Marcar como enviada?</div>
              <div className="evl-confirm-desc">
                Deseja marcar a avaliação de{' '}
                <strong>{getEvaluatee(sentConfirmEv)?.full_name ?? '—'}</strong>{' '}
                como enviada?
              </div>
            </div>
            <div className="evl-confirm-footer">
              <button className="evl-confirm-btn evl-confirm-btn-no" onClick={() => setSentConfirmEv(null)}>
                Não
              </button>
              <button className="evl-confirm-btn evl-confirm-btn-yes" onClick={handleConfirmSent}>
                Sim, marcar como enviada
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
