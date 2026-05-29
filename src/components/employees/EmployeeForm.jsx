import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { useDepartments } from '../../hooks/useDepartments'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'medical_leave', label: 'Baixa médica' },
]

export default function EmployeeForm({ title, initialValues = {}, employees = [], selfId, onSubmit, onClose }) {
  const { departments } = useDepartments()
  const [vals, setVals] = useState({
    employee_number: initialValues.employee_number ?? '',
    full_name:       initialValues.full_name ?? '',
    role:            initialValues.role ?? '',
    department_id:   initialValues.department_id ?? '',
    team_id:         initialValues.team_id ?? '',
    manager_id:      initialValues.manager_id ?? '',
    status:          initialValues.status ?? 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => {
    const value = e.target.value
    setVals(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'department_id' ? { team_id: '' } : {}),
    }))
  }

  const availableTeams = useMemo(
    () => departments.find(d => d.id === vals.department_id)?.teams ?? [],
    [departments, vals.department_id]
  )

  const managerOptions = employees.filter(e => e.id !== selfId)

  const handleSubmit = async () => {
    if (!vals.full_name.trim() || !vals.employee_number.trim()) return
    setError('')
    setSaving(true)
    const payload = {
      employee_number: vals.employee_number.trim(),
      full_name:       vals.full_name.trim(),
      role:            vals.role.trim() || null,
      department_id:   vals.department_id || null,
      team_id:         vals.team_id || null,
      manager_id:      vals.manager_id || null,
      status:          vals.status,
    }
    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="ui-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ui-modal" style={{ maxWidth: 520 }}>
        <div className="ui-modal-header">
          <span className="ui-modal-title">{title}</span>
          <button className="ui-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="ui-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="ui-field">
              <label>Nº Colaborador *</label>
              <input
                className="ui-input"
                value={vals.employee_number}
                onChange={set('employee_number')}
                placeholder="001"
                autoFocus
              />
            </div>
            <div className="ui-field">
              <label>Estado</label>
              <select className="ui-input" value={vals.status} onChange={set('status')}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="ui-field">
            <label>Nome completo *</label>
            <input
              className="ui-input"
              value={vals.full_name}
              onChange={set('full_name')}
              placeholder="Nome completo do colaborador"
            />
          </div>

          <div className="ui-field">
            <label>Função</label>
            <input
              className="ui-input"
              value={vals.role}
              onChange={set('role')}
              placeholder="Ex: Cozinheiro, Chefe de Sala…"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="ui-field">
              <label>Departamento</label>
              <select className="ui-input" value={vals.department_id} onChange={set('department_id')}>
                <option value="">— Sem departamento —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label>Equipa</label>
              <select
                className="ui-input"
                value={vals.team_id}
                onChange={set('team_id')}
                disabled={!vals.department_id || availableTeams.length === 0}
              >
                <option value="">— Sem equipa —</option>
                {availableTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="ui-field">
            <label>Superior hierárquico</label>
            <select className="ui-input" value={vals.manager_id} onChange={set('manager_id')}>
              <option value="">— Sem superior —</option>
              {managerOptions.map(e => (
                <option key={e.id} value={e.id}>
                  {e.full_name} (#{e.employee_number})
                </option>
              ))}
            </select>
          </div>

          {error && <p className="ui-error">{error}</p>}
        </div>
        <div className="ui-modal-footer">
          <button className="ui-btn secondary" onClick={onClose}>Cancelar</button>
          <button
            className="ui-btn primary"
            onClick={handleSubmit}
            disabled={saving || !vals.full_name.trim() || !vals.employee_number.trim()}
          >
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
