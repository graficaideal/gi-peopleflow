import { useState, useMemo, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useDepartments } from '../../hooks/useDepartments'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'medical_leave', label: 'Baixa médica' },
]

export default function EmployeeForm({ title, initialValues = {}, employees = [], selfId, onSubmit, onClose }) {
  const { departments } = useDepartments()
  const [jobCategories, setJobCategories] = useState([])
  const [catSearch, setCatSearch] = useState('')
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef(null)

  const [vals, setVals] = useState({
    employee_number:  initialValues.employee_number ?? '',
    full_name:        initialValues.full_name ?? '',
    email:            initialValues.email ?? '',
    job_category_id:  initialValues.job_category_id ?? '',
    department_id:    initialValues.department_id ?? '',
    team_id:          initialValues.team_id ?? '',
    manager_id:       initialValues.manager_id ?? '',
    status:           initialValues.status ?? 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('pf_job_categories').select('id, code, name').order('name').then(({ data }) => {
      setJobCategories(data ?? [])
    })
  }, [])

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

  const catLabel = (c) => c.code ? `${c.code} — ${c.name}` : c.name
  const selectedCatLabel = catLabel(jobCategories.find(c => c.id === vals.job_category_id) ?? {})
  const filteredCats = useMemo(() => {
    const q = catSearch.toLowerCase()
    return jobCategories.filter(c =>
      c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q)
    )
  }, [jobCategories, catSearch])

  const handleSubmit = async () => {
    if (!vals.full_name.trim() || !vals.employee_number.trim()) return
    setError('')
    setSaving(true)
    const payload = {
      employee_number:  vals.employee_number.trim().padStart(4, '0'),
      full_name:        vals.full_name.trim(),
      email:            vals.email.trim() || null,
      job_category_id:  vals.job_category_id || null,
      department_id:    vals.department_id || null,
      team_id:          vals.team_id || null,
      manager_id:       vals.manager_id || null,
      status:           vals.status,
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
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v) setVals(prev => ({ ...prev, employee_number: v.padStart(4, '0') }))
                }}
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

          <div className="ui-field" ref={catRef} style={{ position: 'relative' }}>
            <label>Categoria Profissional</label>
            <div style={{ position: 'relative' }}>
              <input
                className="ui-input"
                value={catOpen ? catSearch : selectedCatLabel}
                onChange={e => { setCatSearch(e.target.value); setCatOpen(true) }}
                onFocus={() => { setCatSearch(''); setCatOpen(true) }}
                onBlur={() => setTimeout(() => setCatOpen(false), 150)}
                placeholder="Pesquisar categoria…"
                style={{ paddingRight: vals.job_category_id ? 28 : undefined }}
              />
              {vals.job_category_id && !catOpen && (
                <button
                  type="button"
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
                  }}
                  onClick={() => setVals(prev => ({ ...prev, job_category_id: '' }))}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {catOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                maxHeight: 200, overflowY: 'auto', marginTop: 4,
              }}>
                {filteredCats.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Sem resultados
                  </div>
                ) : filteredCats.map(c => (
                  <div
                    key={c.id}
                    onMouseDown={() => {
                      setVals(prev => ({ ...prev, job_category_id: c.id }))
                      setCatSearch('')
                      setCatOpen(false)
                    }}
                    style={{
                      padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                      color: c.id === vals.job_category_id ? 'var(--color-accent)' : 'var(--color-text)',
                      fontWeight: c.id === vals.job_category_id ? 600 : 400,
                      background: c.id === vals.job_category_id ? 'var(--color-hover)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (c.id !== vals.job_category_id) e.currentTarget.style.background = 'var(--color-hover)' }}
                    onMouseLeave={e => { if (c.id !== vals.job_category_id) e.currentTarget.style.background = 'transparent' }}
                  >
                    {catLabel(c)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ui-field">
            <label>Email</label>
            <input
              type="email"
              className="ui-input"
              value={vals.email}
              onChange={set('email')}
              placeholder="nome@empresa.pt"
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
