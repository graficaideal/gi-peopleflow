import CriteriaRow from './CriteriaRow'
import { scoreToLabel } from '../../utils/formatters'

function avgColor(v) {
  if (!v) return 'var(--color-text-muted)'
  if (v <= 2) return '#e05252'
  if (v <= 3) return '#ca8a04'
  return '#16a34a'
}

export default function EvaluationSummary({ evaluation, criteria }) {
  const scoreMap = Object.fromEntries((evaluation.answers ?? []).map(a => [a.criteria_id, a.score]))
  const scores = criteria.map(c => scoreMap[c.id]).filter(Boolean)
  const avg = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null

  return (
    <div>
      <div className="ev-criteria-list">
        {criteria.map(c => (
          <CriteriaRow
            key={c.id}
            criterion={c}
            score={scoreMap[c.id]}
            readonly
          />
        ))}
      </div>

      {evaluation.notes && (
        <div className="ev-notes-box">
          <div className="ev-box-title">Notas</div>
          <p className="ev-notes-text">{evaluation.notes}</p>
        </div>
      )}

      <div className="ev-avg-box">
        <span className="ev-avg-label">Média final</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>
            {avg ?? '—'}
          </span>
          {avg && (
            <span style={{ fontSize: 14, color: avgColor(avg), fontWeight: 600 }}>
              {scoreToLabel(avg)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
