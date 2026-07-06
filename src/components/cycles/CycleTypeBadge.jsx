import { formatCycleType } from '../../utils/formatters'

const CONFIG = {
  quarterly:   { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed' },
  semi_annual: { bg: 'rgba(217,119,6,0.12)',  color: '#d97706' },
  annual:      { bg: 'rgba(13,148,136,0.12)', color: '#0d9488' },
}

export default function CycleTypeBadge({ type }) {
  const cfg = CONFIG[type] ?? { bg: 'rgba(140,140,140,0.1)', color: '#888' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.2px',
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {formatCycleType(type)}
    </span>
  )
}
