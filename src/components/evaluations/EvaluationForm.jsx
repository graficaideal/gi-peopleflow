import { useState } from 'react'
import CriteriaRow from './CriteriaRow'
import { scoreToLabel } from '../../utils/formatters'

function avgColor(v) {
  if (!v) return 'var(--color-text-muted)'
  if (v <= 2) return '#e05252'
  if (v <= 3) return '#ca8a04'
  return '#16a34a'
}

export default function EvaluationForm({ evaluation, criteria, onSubmit }) {
  const initial = Object.fromEntries((evaluation.answers ?? []).map(a => [a.criteria_id, a.score]))
  const [scores, setScores] = useState(initial)
  const [notes, setNotes] = useState(evaluation.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setScore = (criteriaId, score) => setScores(s => ({ ...s, [criteriaId]: score }))

  const scoreValues = criteria.map(c => scores[c.id]).filter(Boolean)
  const allScored = scoreValues.length === criteria.length
  const avg = scoreValues.length
    ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allScored) { setError('Preenche todos os critérios antes de submeter.'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ scores, notes: notes.trim() || null })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="ev-criteria-list">
        {criteria.map(c => (
          <CriteriaRow
            key={c.id}
            criterion={c}
            score={scores[c.id]}
            onChange={score => setScore(c.id, score)}
          />
        ))}
      </div>

      <div className="ev-notes-section">
        <label className="ev-field-label">Notas (opcional)</label>
        <textarea
          className="ev-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Observações adicionais…"
          rows={3}
        />
      </div>

      {avg !== null && (
        <div className="ev-live-avg">
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Média parcial ({scoreValues.length}/{criteria.length} critérios)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>{avg}</span>
            <span style={{ fontSize: 13, color: avgColor(avg), fontWeight: 600 }}>{scoreToLabel(avg)}</span>
          </div>
        </div>
      )}

      {error && <p className="ev-error">{error}</p>}

      <div className="ev-submit-row">
        <button type="submit" className="ev-btn ev-btn-primary" disabled={saving || !allScored}>
          {saving ? 'A submeter…' : 'Submeter avaliação'}
        </button>
        {!allScored && (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {scoreValues.length} de {criteria.length} critérios preenchidos
          </span>
        )}
      </div>
    </form>
  )
}
