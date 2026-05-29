import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { scoreToLabel } from '../../utils/formatters'

const STATUS_CONFIG = {
  active:        { label: 'Ativo',         cls: 'active' },
  inactive:      { label: 'Inativo',       cls: 'inactive' },
  medical_leave: { label: 'Baixa médica',  cls: 'medical_leave' },
}

function initials(name) {
  return (name ?? '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function scoreColor(avg) {
  const v = parseFloat(avg)
  if (isNaN(v)) return 'var(--color-text-muted)'
  if (v <= 2) return '#e05252'
  if (v <= 3) return '#ca8a04'
  return '#16a34a'
}

export default function EmployeeTable({ employees, lastEvalScores = {}, onEdit, onDelete }) {
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
            <th>Última Avaliação</th>
            <th style={{ width: 72 }} />
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const cfg = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.inactive
            const avg = lastEvalScores[emp.id] ?? null   // { avg, inProgress } | null
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
                <td>
                  {avg ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: scoreColor(avg.avg), lineHeight: 1 }}>
                          {avg.avg}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(avg.avg) }}>
                          {scoreToLabel(avg.avg)}
                        </span>
                      </span>
                      {avg.inProgress && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontSize: 10, fontWeight: 600, color: '#a16207',
                          background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)',
                          padding: '1px 6px', borderRadius: 20, whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#ca8a04', flexShrink: 0 }} />
                          em curso
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-border)', fontSize: 13 }}>—</span>
                  )}
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
