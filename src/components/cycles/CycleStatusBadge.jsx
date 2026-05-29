const CONFIG = {
  draft:  { label: 'Rascunho', bg: 'rgba(140,140,140,0.1)',  color: '#888' },
  active: { label: 'Ativo',    bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
  closed: { label: 'Fechado',  bg: 'rgba(91,111,160,0.12)',  color: '#5b6fa0' },
}

export default function CycleStatusBadge({ status }) {
  const cfg = CONFIG[status] ?? CONFIG.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.2px',
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}
