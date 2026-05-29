import { SCORE_LABELS } from '../../lib/constants'

function scoreColor(s) {
  if (!s) return 'var(--color-text-muted)'
  if (s <= 2) return '#e05252'
  if (s <= 3) return '#ca8a04'
  return '#16a34a'
}

export default function ScoreDisplay({ score, showLabel = true }) {
  if (!score) return <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>{score}</span>
      {showLabel && (
        <span style={{ fontSize: 12, color: scoreColor(score), fontWeight: 600 }}>{SCORE_LABELS[score]}</span>
      )}
    </span>
  )
}
