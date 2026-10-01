import { useState } from 'react'
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react'
import { EVALUATION_TYPE_LABELS } from '../../lib/constants'

// Panel 2: per evaluation type, the active criteria associated in pf_criteria_types.
// Changes only affect future cycles (running cycles use the pf_cycle_criteria snapshot).
export default function CriteriaByTypeSettings({ criteria, criteriaTypes, onReorder, onAddToType, onRemoveFromType }) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState({}) // evaluation_type -> selected criteria_id

  const labelOf = Object.fromEntries(criteria.map(c => [c.id, c.label]))

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p className="st-section-desc">As alterações só se aplicam a ciclos futuros.</p>
      {error && <p className="st-error">{error}</p>}

      {Object.entries(EVALUATION_TYPE_LABELS).map(([type, typeLabel]) => {
        const rows = criteriaTypes
          .filter(r => r.evaluation_type === type && r.active)
          .sort((a, b) => a.sort_order - b.sort_order)
        const inType = new Set(rows.map(r => r.criteria_id))
        const available = criteria.filter(c => c.active && !inType.has(c.id))

        const move = (i, dir) => {
          const next = [...rows]
          ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
          run(() => onReorder(type, next.map(r => r.criteria_id)))
        }

        return (
          <div key={type}>
            <div className="st-settings-label" style={{ marginBottom: 8 }}>{typeLabel}</div>
            <div className="st-card">
              {rows.length === 0 && (
                <div className="st-criteria-row"><span className="st-criteria-label" style={{ opacity: 0.5 }}>Sem critérios associados</span></div>
              )}
              {rows.map((r, i) => (
                <div key={r.criteria_id} className="st-criteria-row">
                  <span className="st-criteria-num">{i + 1}</span>
                  <span className="st-criteria-label">{labelOf[r.criteria_id] ?? '—'}</span>
                  <div className="st-criteria-actions">
                    <button className="st-action-btn" onClick={() => move(i, -1)} disabled={i === 0 || busy} title="Mover para cima">
                      <ChevronUp size={13} />
                    </button>
                    <button className="st-action-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1 || busy} title="Mover para baixo">
                      <ChevronDown size={13} />
                    </button>
                    <button
                      className="st-action-btn st-action-danger"
                      onClick={() => run(() => onRemoveFromType(type, r.criteria_id))}
                      disabled={busy}
                      title="Remover deste tipo (apenas ciclos futuros)"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {available.length > 0 && (
                <div className="st-relation-add">
                  <select
                    className="st-input"
                    value={picking[type] ?? ''}
                    onChange={e => setPicking(p => ({ ...p, [type]: e.target.value }))}
                  >
                    <option value="">Adicionar critério existente…</option>
                    {available.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <button
                    className="st-save-btn"
                    disabled={!picking[type] || busy}
                    onClick={() => run(async () => {
                      await onAddToType(type, picking[type])
                      setPicking(p => ({ ...p, [type]: '' }))
                    })}
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
