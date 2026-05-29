import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Building2, Users, UserCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useEmployees } from '../hooks/useEmployees'
import EmployeeForm from '../components/employees/EmployeeForm'

const STATUS_CONFIG = {
  active:        { label: 'Ativo',        cls: 'active' },
  inactive:      { label: 'Inativo',      cls: 'inactive' },
  medical_leave: { label: 'Baixa médica', cls: 'medical_leave' },
}

function initials(name) {
  return (name ?? '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees, updateEmployee, deleteEmployee } = useEmployees()

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchEmployee = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const { data, error } = await supabase
      .from('pf_employees')
      .select(`
        *,
        department:pf_departments(id, name),
        team:pf_teams(id, name),
        manager:pf_employees!manager_id(id, full_name, employee_number)
      `)
      .eq('id', id)
      .single()
    if (error) { setFetchError(error.message); setLoading(false); return }
    setEmployee(data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchEmployee() }, [fetchEmployee])

  const handleUpdate = async (values) => {
    await updateEmployee(id, values)
    await fetchEmployee()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEmployee(id)
      navigate('/employees')
    } catch {
      setDeleting(false)
    }
  }

  const BackLink = () => (
    <Link
      to="/employees"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24,
        transition: 'color 0.15s',
      }}
    >
      <ArrowLeft size={14} /> Colaboradores
    </Link>
  )

  if (loading) return (
    <div>
      <BackLink />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="ui-skeleton" style={{ height: 108 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="ui-skeleton" style={{ height: 72 }} />)}
        </div>
      </div>
    </div>
  )

  if (fetchError || !employee) return (
    <div>
      <BackLink />
      <p className="ui-error">{fetchError ?? 'Colaborador não encontrado.'}</p>
    </div>
  )

  const statusCfg = STATUS_CONFIG[employee.status] ?? STATUS_CONFIG.inactive

  return (
    <div>
      <BackLink />

      {/* Profile header */}
      <div className="empd-header">
        <div className="empd-avatar">{initials(employee.full_name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.4px' }}>
              {employee.full_name}
            </h1>
            <span className={`emp-status ${statusCfg.cls}`}>{statusCfg.label}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {employee.role ?? 'Sem função definida'}
            <span style={{ margin: '0 7px', opacity: 0.4 }}>·</span>
            #{employee.employee_number}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="ui-btn secondary" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Editar
          </button>
          <button className="ui-btn danger" onClick={() => setDeleteConfirm(true)}>
            <Trash2 size={13} /> Apagar
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="empd-grid">
        <div className="empd-card">
          <div className="empd-card-icon" style={{ background: 'rgba(224,203,75,0.1)', color: '#b8a738' }}>
            <Building2 size={16} />
          </div>
          <div>
            <div className="empd-card-label">Departamento</div>
            <div className="empd-card-value">{employee.department?.name ?? '—'}</div>
          </div>
        </div>
        <div className="empd-card">
          <div className="empd-card-icon" style={{ background: 'rgba(45,100,200,0.08)', color: '#3b74d4' }}>
            <Users size={16} />
          </div>
          <div>
            <div className="empd-card-label">Equipa</div>
            <div className="empd-card-value">{employee.team?.name ?? '—'}</div>
          </div>
        </div>
        <div className="empd-card">
          <div className="empd-card-icon" style={{ background: 'rgba(100,60,200,0.08)', color: '#7c50d4' }}>
            <UserCheck size={16} />
          </div>
          <div>
            <div className="empd-card-label">Superior hierárquico</div>
            <div className="empd-card-value">
              {employee.manager ? (
                <Link
                  to={`/employees/${employee.manager.id}`}
                  style={{ color: 'var(--color-accent)', fontWeight: 600 }}
                >
                  {employee.manager.full_name}
                </Link>
              ) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <EmployeeForm
          title="Editar Colaborador"
          initialValues={{
            ...employee,
            department_id: employee.department?.id ?? employee.department_id ?? '',
            team_id:       employee.team?.id       ?? employee.team_id       ?? '',
            manager_id:    employee.manager?.id    ?? employee.manager_id    ?? '',
          }}
          employees={employees}
          selfId={id}
          onSubmit={handleUpdate}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="ui-modal-overlay"
          onClick={e => e.target === e.currentTarget && setDeleteConfirm(false)}
        >
          <div className="ui-modal" style={{ maxWidth: 380 }}>
            <div className="ui-modal-header">
              <span className="ui-modal-title">Confirmar remoção</span>
              <button className="ui-modal-close" onClick={() => setDeleteConfirm(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="ui-modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
                Tem a certeza que quer apagar <strong>{employee.full_name}</strong>?
              </p>
            </div>
            <div className="ui-modal-footer">
              <button className="ui-btn secondary" onClick={() => setDeleteConfirm(false)}>Cancelar</button>
              <button className="ui-btn danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'A apagar…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
