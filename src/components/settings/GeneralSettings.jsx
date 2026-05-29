import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { CYCLE_TYPE_LABELS } from '../../lib/constants'

export default function GeneralSettings({ settings, onSave }) {
  const [peerLimit, setPeerLimit] = useState(settings.peer_evaluator_limit ?? '2')
  const [cycleType, setCycleType] = useState(settings.default_cycle_type ?? 'annual')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    setPeerLimit(settings.peer_evaluator_limit ?? '2')
    setCycleType(settings.default_cycle_type ?? 'annual')
  }, [settings])

  const handleSave = async () => {
    const limit = parseInt(peerLimit, 10)
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      setError('O limite de avaliadores pares deve ser um número entre 1 e 20.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ peer_evaluator_limit: String(limit), default_cycle_type: cycleType })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="st-card" style={{ padding: '2px 0' }}>
      {/* Peer limit */}
      <div className="st-settings-field">
        <label className="st-settings-label">Limite de avaliadores pares</label>
        <p className="st-settings-hint">
          Número máximo de colegas atribuídos para avaliar cada colaborador ao gerar um ciclo.
        </p>
        <input
          type="number"
          className="st-input"
          style={{ width: 80 }}
          min={1}
          max={20}
          value={peerLimit}
          onChange={e => setPeerLimit(e.target.value)}
        />
      </div>

      <div className="st-divider" />

      {/* Default cycle type */}
      <div className="st-settings-field">
        <label className="st-settings-label">Tipo de ciclo por defeito</label>
        <p className="st-settings-hint">
          Pré-seleccionado ao criar um novo ciclo de avaliação.
        </p>
        <select
          className="st-input"
          style={{ width: 160 }}
          value={cycleType}
          onChange={e => setCycleType(e.target.value)}
        >
          {Object.entries(CYCLE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Footer */}
      <div className="st-settings-footer">
        {error && <p className="st-error" style={{ margin: 0 }}>{error}</p>}
        <button
          className="st-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saved
            ? <><Check size={13} /> Guardado</>
            : saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
