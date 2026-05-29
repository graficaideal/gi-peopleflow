import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { CYCLE_TYPE_LABELS, CYCLE_STATUS_LABELS } from '../../lib/constants'

const EMPTY = {
  name: '',
  type: 'annual',
  status: 'draft',
  anonymous: false,
  start_date: '',
  end_date: '',
}

export default function CycleForm({ title, initialValues = {}, hasActiveCycle = false, onSubmit, onClose }) {
  const [values, setValues] = useState({ ...EMPTY, ...initialValues })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setValues(v => ({ ...v, [field]: value }))

  const willDeactivate =
    values.status === 'active' &&
    hasActiveCycle &&
    initialValues.status !== 'active'

  const validate = () => {
    if (!values.name.trim()) return 'O nome é obrigatório.'
    if (values.start_date && values.end_date && values.end_date < values.start_date)
      return 'A data de fim não pode ser anterior à data de início.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        name: values.name.trim(),
        type: values.type,
        status: values.status,
        anonymous: values.anonymous,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="cy-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cy-modal">
        <div className="cy-modal-header">
          <span className="cy-modal-title">{title}</span>
          <button className="cy-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="cy-modal-body">
            <div className="cy-field">
              <label>Nome</label>
              <input
                className="cy-input"
                value={values.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ex: Avaliação Anual 2025"
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="cy-field">
                <label>Tipo</label>
                <select className="cy-input" value={values.type} onChange={e => set('type', e.target.value)}>
                  {Object.entries(CYCLE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="cy-field">
                <label>Estado</label>
                <select className="cy-input" value={values.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(CYCLE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="cy-field">
                <label>Data de início</label>
                <input
                  type="date"
                  className="cy-input"
                  value={values.start_date ?? ''}
                  onChange={e => set('start_date', e.target.value)}
                />
              </div>
              <div className="cy-field">
                <label>Data de fim</label>
                <input
                  type="date"
                  className="cy-input"
                  value={values.end_date ?? ''}
                  onChange={e => set('end_date', e.target.value)}
                />
              </div>
            </div>

            <div className="cy-toggle-row" onClick={() => set('anonymous', !values.anonymous)}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Avaliações anónimas</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Os avaliadores não são identificados no relatório
                </div>
              </div>
              <div className={`cy-toggle${values.anonymous ? ' cy-toggle-on' : ''}`}>
                <div className="cy-toggle-knob" />
              </div>
            </div>

            {willDeactivate && (
              <div className="cy-warn">
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                O ciclo actualmente activo será movido para Rascunho.
              </div>
            )}

            {error && <p className="cy-error">{error}</p>}
          </div>

          <div className="cy-modal-footer">
            <button type="button" className="cy-btn cy-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="cy-btn cy-btn-primary" disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
