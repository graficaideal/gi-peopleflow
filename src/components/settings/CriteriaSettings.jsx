import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react'

export default function CriteriaSettings({ criteria, onUpdateLabel, onReorder }) {
  const [editingId, setEditingId]   = useState(null)
  const [editValue, setEditValue]   = useState('')
  const [savingId, setSavingId]     = useState(null)
  const [reordering, setReordering] = useState(false)
  const [error, setError]           = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  const startEdit = (c) => {
    setEditingId(c.id)
    setEditValue(c.label)
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
    setError('')
  }

  const saveEdit = async (id) => {
    const label = editValue.trim()
    if (!label) { setError('O label não pode estar vazio.'); return }
    setSavingId(id)
    setError('')
    try {
      await onUpdateLabel(id, label)
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter')  { e.preventDefault(); saveEdit(id) }
    if (e.key === 'Escape') { cancelEdit() }
  }

  const move = async (index, dir) => {
    const next = [...criteria]
    const swapIdx = index + dir
    if (swapIdx < 0 || swapIdx >= next.length) return
    ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
    setReordering(true)
    try {
      await onReorder(next)
    } finally {
      setReordering(false)
    }
  }

  return (
    <div>
      {error && <p className="st-error" style={{ marginBottom: 10 }}>{error}</p>}
      <div className="st-card">
        {criteria.map((c, i) => (
          <div key={c.id} className={`st-criteria-row${editingId === c.id ? ' st-editing' : ''}`}>
            <span className="st-criteria-num">{i + 1}</span>

            {editingId === c.id ? (
              <>
                <input
                  ref={inputRef}
                  className="st-edit-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, c.id)}
                />
                <div className="st-criteria-actions" style={{ opacity: 1 }}>
                  <button
                    className="st-action-btn st-action-confirm"
                    onClick={() => saveEdit(c.id)}
                    disabled={savingId === c.id}
                    title="Guardar"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    className="st-action-btn"
                    onClick={cancelEdit}
                    title="Cancelar"
                  >
                    <X size={13} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="st-criteria-label">{c.label}</span>
                <div className="st-criteria-actions">
                  <button
                    className="st-action-btn"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reordering}
                    title="Mover para cima"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    className="st-action-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === criteria.length - 1 || reordering}
                    title="Mover para baixo"
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    className="st-action-btn"
                    onClick={() => startEdit(c)}
                    title="Editar label"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
