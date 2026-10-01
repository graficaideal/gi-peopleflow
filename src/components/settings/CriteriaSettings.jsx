import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, Trash2, Plus } from 'lucide-react'
import { EVALUATION_TYPE_LABELS } from '../../lib/constants'

// Panel 1: every criterion in pf_criteria — rename, toggle active, delete (if never used), add new.
export default function CriteriaSettings({ criteria, protectedIds, usedIds, onUpdateLabel, onToggleActive, onDelete, onAdd }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [busyId, setBusyId]       = useState(null)
  const [error, setError]         = useState('')
  const [adding, setAdding]       = useState(false)
  const [newLabel, setNewLabel]   = useState('')
  const [newTypes, setNewTypes]   = useState([])
  const [saving, setSaving]       = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  const run = async (id, fn) => {
    setBusyId(id)
    setError('')
    try { await fn() } catch (err) { setError(err.message) } finally { setBusyId(null) }
  }

  const startEdit = (c) => { setEditingId(c.id); setEditValue(c.label); setError('') }
  const cancelEdit = () => { setEditingId(null); setEditValue(''); setError('') }

  const saveEdit = (id) => {
    const label = editValue.trim()
    if (!label) { setError('O label não pode estar vazio.'); return }
    run(id, async () => { await onUpdateLabel(id, label); setEditingId(null) })
  }

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter')  { e.preventDefault(); saveEdit(id) }
    if (e.key === 'Escape') cancelEdit()
  }

  const toggleType = (t) =>
    setNewTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const closeAdd = () => { setAdding(false); setNewLabel(''); setNewTypes([]); setError('') }

  const submitAdd = async () => {
    const label = newLabel.trim()
    if (!label) { setError('O nome não pode estar vazio.'); return }
    if (!newTypes.length) { setError('Seleciona pelo menos um tipo de avaliação.'); return }
    setSaving(true)
    setError('')
    try {
      await onAdd(label, newTypes)
      closeAdd()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {error && <p className="st-error" style={{ marginBottom: 10 }}>{error}</p>}
      <div className="st-card">
        {criteria.map((c, i) => {
          const canDelete = !protectedIds.has(c.id)
          const used = usedIds.has(c.id)
          return (
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
                    <button className="st-action-btn st-action-confirm" onClick={() => saveEdit(c.id)} disabled={busyId === c.id} title="Guardar">
                      <Check size={13} />
                    </button>
                    <button className="st-action-btn" onClick={cancelEdit} title="Cancelar">
                      <X size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="st-criteria-label" style={c.active ? undefined : { opacity: 0.5 }}>{c.label}</span>
                  <div className="st-criteria-actions">
                    <button className="st-action-btn" onClick={() => startEdit(c)} title="Editar label">
                      <Pencil size={12} />
                    </button>
                    {canDelete && (
                      <span title={used ? 'Este critério já foi usado num ciclo' : 'Eliminar critério'}>
                        <button
                          className="st-action-btn st-action-danger"
                          onClick={() => run(c.id, () => onDelete(c.id))}
                          disabled={used || busyId === c.id}
                          style={used ? { pointerEvents: 'none' } : undefined}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.active}
                    aria-label={c.active ? 'Inativar critério' : 'Ativar critério'}
                    title={c.active ? 'Ativo — clicar para inativar' : 'Inativo — clicar para ativar'}
                    className={`st-toggle${c.active ? ' st-toggle-on' : ''}`}
                    onClick={() => run(c.id, () => onToggleActive(c.id, !c.active))}
                    disabled={busyId === c.id}
                  >
                    <span className="st-toggle-knob" />
                  </button>
                </>
              )}
            </div>
          )
        })}

        {adding ? (
          <div className="st-relation-add" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <input
              className="st-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="Nome do critério"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
              {Object.entries(EVALUATION_TYPE_LABELS).map(([value, label]) => (
                <label key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={newTypes.includes(value)} onChange={() => toggleType(value)} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="st-action-btn" style={{ width: 'auto', padding: '0 12px' }} onClick={closeAdd}>Cancelar</button>
              <button className="st-save-btn" onClick={submitAdd} disabled={saving}>
                {saving ? 'A guardar…' : 'Adicionar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="st-relation-add">
            <button className="st-save-btn" onClick={() => { setAdding(true); setError('') }}>
              <Plus size={13} /> Novo critério
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
