import { EVALUATION_TYPE_LABELS } from '../../lib/constants'

const TYPE_CONFIG = {
  self:    { bg: 'rgba(91,111,160,0.1)',  color: '#5b6fa0' },
  peer:    { bg: 'rgba(34,197,94,0.1)',   color: '#16a34a' },
  manager: { bg: 'rgba(194,87,10,0.1)',   color: '#c2570a' },
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendente',  bg: 'rgba(234,179,8,0.1)',  color: '#a16207' },
  submitted: { label: 'Submetida', bg: 'rgba(34,197,94,0.1)',  color: '#16a34a' },
}

export function EvaluationTypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.self
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {EVALUATION_TYPE_LABELS[type] ?? type}
    </span>
  )
}

export function EvaluationStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}
