import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Building2, Users, UserCheck, X, History } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useEmployees } from '../hooks/useEmployees'
import EmployeeForm from '../components/employees/EmployeeForm'
import { formatDate, formatCycleType, scoreToLabel } from '../utils/formatters'
import { EVALUATION_TYPE_LABELS } from '../lib/constants'

// ── History helpers ──────────────────────────────────────────────────────────

function scoreColor(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return 'var(--color-text-muted)'
  if (n <= 2) return '#e05252'
  if (n <= 3) return '#ca8a04'
  return '#16a34a'
}

function buildHistory(evaluations) {
  const byCycle = {}
  evaluations.forEach(ev => {
    const cycle = Array.isArray(ev.cycle) ? ev.cycle[0] : ev.cycle
    if (!cycle) return
    if (!byCycle[cycle.id]) byCycle[cycle.id] = { cycle, evals: [] }
    byCycle[cycle.id].evals.push(ev)
  })

  return Object.values(byCycle).map(({ cycle, evals }) => {
    const avgByType = {}
    const allScores = []
    for (const type of ['self', 'peer', 'manager']) {
      const scores = evals
        .filter(e => e.type === type)
        .flatMap(e => (e.answers ?? []).map(a => a.score).filter(Boolean))
      if (scores.length) {
        avgByType[type] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        allScores.push(...scores)
      }
    }
    const globalAvg = allScores.length
      ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
      : null
    return { cycle, avgByType, globalAvg }
  }).sort((a, b) => {
    const da = a.cycle.end_date ?? ''
    const db = b.cycle.end_date ?? ''
    return db.localeCompare(da)
  })
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

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

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('pf_evaluations')
      .select(`
        id, type,
        cycle:pf_evaluation_cycles(id, name, type, end_date),
        answers:pf_evaluation_answers(score)
      `)
      .eq('evaluatee_id', id)
      .eq('status', 'submitted')
    setHistory(buildHistory(data ?? []))
    setHistoryLoading(false)
  }, [id])

  useEffect(() => {
    fetchEmployee()
    fetchHistory()
  }, [fetchEmployee, fetchHistory])

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
  const rawManager = Array.isArray(employee.manager) ? (employee.manager[0] ?? null) : employee.manager
  const manager = rawManager ?? employees.find(e => e.id === employee.manager_id) ?? null

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
              {manager ? (
                <Link
                  to={`/employees/${manager.id}`}
                  style={{ color: 'var(--color-accent)', fontWeight: 600 }}
                >
                  {manager.full_name}
                </Link>
              ) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Evaluation history */}
      <div style={{ marginTop: 28 }}>
        <style>{`
          .eh-section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 12px;
          }
          .eh-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 10px;
          }
          .eh-card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 13px 18px;
            border-bottom: 1px solid var(--color-border);
            flex-wrap: wrap;
          }
          .eh-cycle-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--color-text);
            flex: 1;
            min-width: 0;
          }
          .eh-cycle-type {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 20px;
            background: var(--color-hover);
            color: var(--color-text-muted);
            white-space: nowrap;
          }
          .eh-cycle-date {
            font-size: 11px;
            color: var(--color-text-muted);
            white-space: nowrap;
          }
          .eh-scores {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            divide-x: 1px solid var(--color-border);
          }
          .eh-score-cell {
            padding: 14px 18px;
            border-right: 1px solid var(--color-border);
          }
          .eh-score-cell:last-child { border-right: none; }
          .eh-score-cell.eh-global {
            background: rgba(0,0,0,0.015);
          }
          [data-theme='dark'] .eh-score-cell.eh-global {
            background: rgba(255,255,255,0.02);
          }
          .eh-score-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .eh-score-value {
            font-size: 22px;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 3px;
          }
          .eh-score-sublabel {
            font-size: 11px;
            font-weight: 500;
          }
          .eh-empty {
            padding: 36px 18px;
            text-align: center;
            font-size: 13px;
            color: var(--color-text-muted);
          }
          .eh-skeleton {
            height: 110px;
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            margin-bottom: 10px;
          }
        `}</style>

        <div className="eh-section-title">
          <History size={13} />
          Histórico de Avaliações
        </div>

        {historyLoading ? (
          [1, 2].map(i => <div key={i} className="eh-skeleton" />)
        ) : history.length === 0 ? (
          <div className="eh-card">
            <div className="eh-empty">Sem avaliações submetidas para este colaborador.</div>
          </div>
        ) : history.map(({ cycle, avgByType, globalAvg }) => (
          <div key={cycle.id} className="eh-card">
            <div className="eh-card-header">
              <span className="eh-cycle-name">{cycle.name}</span>
              <span className="eh-cycle-type">{formatCycleType(cycle.type)}</span>
              {cycle.end_date && (
                <span className="eh-cycle-date">{formatDate(cycle.end_date)}</span>
              )}
            </div>
            <div className="eh-scores">
              {['self', 'peer', 'manager'].map(type => (
                <div key={type} className="eh-score-cell">
                  <div className="eh-score-label">{EVALUATION_TYPE_LABELS[type]}</div>
                  {avgByType[type] ? (
                    <>
                      <div className="eh-score-value" style={{ color: scoreColor(avgByType[type]) }}>
                        {avgByType[type]}
                      </div>
                      <div className="eh-score-sublabel" style={{ color: scoreColor(avgByType[type]) }}>
                        {scoreToLabel(avgByType[type])}
                      </div>
                    </>
                  ) : (
                    <div className="eh-score-value" style={{ color: 'var(--color-border)', fontSize: 16 }}>—</div>
                  )}
                </div>
              ))}
              <div className="eh-score-cell eh-global">
                <div className="eh-score-label">Global</div>
                {globalAvg ? (
                  <>
                    <div className="eh-score-value" style={{ color: scoreColor(globalAvg) }}>
                      {globalAvg}
                    </div>
                    <div className="eh-score-sublabel" style={{ color: scoreColor(globalAvg) }}>
                      {scoreToLabel(globalAvg)}
                    </div>
                  </>
                ) : (
                  <div className="eh-score-value" style={{ color: 'var(--color-border)', fontSize: 16 }}>—</div>
                )}
              </div>
            </div>
          </div>
        ))}
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
