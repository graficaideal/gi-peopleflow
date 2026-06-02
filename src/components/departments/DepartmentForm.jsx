import { useState } from 'react'
import { X } from 'lucide-react'
import { DEPARTMENT_AREAS, DEPARTMENT_AREA_LABELS } from '../../lib/constants'

export default function DepartmentForm({ title, initialValues = {}, onSubmit, onClose }) {
  const [name, setName] = useState(initialValues.name ?? '')
  const [area, setArea] = useState(initialValues.area ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setError('')
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), area: area || null })
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
              placeholder="Nome do departamento"
              autoFocus
            />
          </div>
          <div className="dept-field">
            <label>Área</label>
            <select
              className="dept-input"
              value={area}
              onChange={e => setArea(e.target.value)}
            >
              <option value="">— Sem área —</option>
              {Object.values(DEPARTMENT_AREAS).map(v => (
                <option key={v} value={v}>{DEPARTMENT_AREA_LABELS[v]}</option>
              ))}
            </select>
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
