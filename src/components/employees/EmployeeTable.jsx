import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'

const STATUS_CONFIG = {
  active:        { label: 'Ativo',         cls: 'active' },
  inactive:      { label: 'Inativo',       cls: 'inactive' },
  medical_leave: { label: 'Baixa médica',  cls: 'medical_leave' },
}

function initials(name) {
  return (name ?? '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function EmployeeTable({ employees, onEdit, onDelete }) {
  const navigate = useNavigate()

  return (
    <div className="emp-table-wrap">
      <table className="emp-table">
        <thead>
          <tr>
            <th style={{ width: 44 }} />
            <th>Colaborador</th>
            <th>Função</th>
            <th>Departamento</th>
            <th>Equipa</th>
            <th>Estado</th>
            <th style={{ width: 72 }} />
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const cfg = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.inactive
            return (
              <tr
                key={emp.id}
                className="emp-row"
                style={{ animationDelay: `${i * 25}ms` }}
                onClick={() => navigate(`/employees/${emp.id}`)}
              >
                <td>
                  <div className="emp-avatar">{initials(emp.full_name)}</div>
                </td>
                <td>
                  <div className="emp-name">{emp.full_name}</div>
                  <div className="emp-number">#{emp.employee_number}</div>
                </td>
                <td className="emp-cell-muted">{emp.role ?? '—'}</td>
                <td className="emp-cell-muted">{emp.department?.name ?? '—'}</td>
                <td className="emp-cell-muted">{emp.team?.name ?? '—'}</td>
                <td>
                  <span className={`emp-status ${cfg.cls}`}>{cfg.label}</span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="emp-row-actions">
                    <button
                      className="ui-action-btn"
                      onClick={() => onEdit(emp)}
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="ui-action-btn danger"
                      onClick={() => onDelete(emp)}
                      title="Apagar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
