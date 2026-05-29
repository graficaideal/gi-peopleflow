import { SCORE_LABELS } from '../../lib/constants'
import ScoreDisplay from './ScoreDisplay'

export default function CriteriaRow({ criterion, score, onChange, readonly = false }) {
  return (
    <div className="cr-row">
      <div className="cr-label">{criterion.label}</div>
      {readonly ? (
        <div style={{ flexShrink: 0, minWidth: 100, textAlign: 'right' }}>
          <ScoreDisplay score={score} />
        </div>
      ) : (
        <div className="cr-scores">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              className={`cr-score-btn${score === n ? ' cr-selected' : ''}`}
              onClick={() => onChange(n)}
              title={SCORE_LABELS[n]}
            >
              <span className="cr-num">{n}</span>
              <span className="cr-lbl">{SCORE_LABELS[n]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
