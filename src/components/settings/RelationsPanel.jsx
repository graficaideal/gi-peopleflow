import { useMemo, useState } from 'react'
import { Link2, X } from 'lucide-react'

export default function RelationsPanel({ title, description, nodes, relations, onAdd, onRemove }) {
  const [selectedA, setSelectedA] = useState('')
  const [selectedB, setSelectedB] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')

  const groups = useMemo(() => {
    const map = new Map()
    for (const n of nodes) {
      const g = n.groupLabel ?? ''
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(n)
    }
    return [...map.entries()]
  }, [nodes])

  const optionGroups = groups.map(([group, items]) => (
    group
      ? <optgroup key={group} label={group}>
          {items.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
        </optgroup>
      : items.map(n => <option key={n.id} value={n.id}>{n.label}</option>)
  ))

  const pairExists = relations.some(r =>
    (r.aId === selectedA && r.bId === selectedB) ||
    (r.aId === selectedB && r.bId === selectedA)
  )
  const canAdd = selectedA && selectedB && selectedA !== selectedB && !pairExists

  const handleAdd = async () => {
    if (!canAdd) return
    setAdding(true)
    setError('')
    try {
      await onAdd(selectedA, selectedB)
      setSelectedA('')
      setSelectedB('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    setRemovingId(id)
    setError('')
    try {
      await onRemove(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div className="st-settings-label" style={{ marginBottom: 2 }}>{title}</div>
        <p className="st-settings-hint" style={{ marginBottom: 0 }}>{description}</p>
      </div>

      {error && <p className="st-error" style={{ marginBottom: 10 }}>{error}</p>}

      <div className="st-card">
        {relations.length === 0 && (
          <p className="st-settings-hint" style={{ padding: 16, marginBottom: 0 }}>
            Nenhum relacionamento configurado.
          </p>
        )}
        {relations.map(r => (
          <div key={r.id} className="st-criteria-row">
            <span className="st-criteria-label">{r.aLabel} ↔ {r.bLabel}</span>
            <div className="st-criteria-actions">
              <button
                className="st-action-btn"
                onClick={() => handleRemove(r.id)}
                disabled={removingId === r.id}
                title="Remover relacionamento"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}

        <div className="st-relation-add">
          <select className="st-input" value={selectedA} onChange={e => setSelectedA(e.target.value)}>
            <option value="">Selecionar…</option>
            {optionGroups}
          </select>
          <Link2 size={14} className="st-relation-icon" />
          <select className="st-input" value={selectedB} onChange={e => setSelectedB(e.target.value)}>
            <option value="">Selecionar…</option>
            {optionGroups}
          </select>
          <button
            className="st-save-btn"
            onClick={handleAdd}
            disabled={!canAdd || adding}
          >
            {adding ? 'A adicionar…' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
