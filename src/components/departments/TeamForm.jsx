import { useState } from 'react'
import { X } from 'lucide-react'

export default function TeamForm({ title, initialValues = {}, onSubmit, onClose }) {
  const [name, setName] = useState(initialValues.name ?? '')
  const [description, setDescription] = useState(initialValues.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setError('')
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="dept-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dept-modal">
        <div className="dept-modal-header">
          <span className="dept-modal-title">{title}</span>
          <button className="dept-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="dept-modal-body">
          <div className="dept-field">
            <label>Nome *</label>
            <input
              className="dept-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Nome da equipa"
              autoFocus
            />
          </div>
          <div className="dept-field">
            <label>Descrição</label>
            <textarea
              className="dept-input dept-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrição opcional…"
            />
          </div>
          {error && <p className="dept-error">{error}</p>}
        </div>
        <div className="dept-modal-footer">
          <button className="dept-btn secondary" onClick={onClose}>Cancelar</button>
          <button
            className="dept-btn primary"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
