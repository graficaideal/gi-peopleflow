import { useState, useMemo, useEffect } from 'react'
import { Plus, Users, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useEmployees } from '../hooks/useEmployees'
import EmployeeTable from '../components/employees/EmployeeTable'
import EmployeeForm from '../components/employees/EmployeeForm'

function calcLastEvalScores(evaluations, cycleMap) {
  const byEvaluatee = {}
  evaluations.forEach(ev => {
    if (!byEvaluatee[ev.evaluatee_id]) byEvaluatee[ev.evaluatee_id] = []
    byEvaluatee[ev.evaluatee_id].push(ev)
  })

  const result = {}
  for (const [empId, evals] of Object.entries(byEvaluatee)) {
    const mostRecent = [...new Set(evals.map(e => e.cycle_id))]
      .map(cid => cycleMap[cid])
      .filter(Boolean)
      .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))[0]

    if (!mostRecent) continue

    const scores = evals
      .filter(e => e.cycle_id === mostRecent.id)
      .flatMap(e => (e.answers ?? []).map(a => a.score).filter(Boolean))

    if (scores.length)
      result[empId] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  }
  return result
}

const STATUS_FILTERS = [
  { value: null,            label: 'Todos' },
  { value: 'active',        label: 'Ativos' },
  { value: 'inactive',      label: 'Inativos' },
  { value: 'medical_leave', label: 'Baixa médica' },
]

export default function Employees() {
  const { employees, loading, error, createEmployee, updateEmployee, deleteEmployee } = useEmployees()
  const [lastEvalScores, setLastEvalScores] = useState({})

  useEffect(() => {
    const loadScores = async () => {
      const { data: cycles } = await supabase
        .from('pf_evaluation_cycles')
        .select('id, end_date')
        .eq('status', 'closed')

      if (!cycles?.length) return

      const { data: evals } = await supabase
        .from('pf_evaluations')
        .select('evaluatee_id, cycle_id, answers:pf_evaluation_answers(score)')
        .in('cycle_id', cycles.map(c => c.id))
        .eq('status', 'submitted')

      if (!evals?.length) return

      const cycleMap = Object.fromEntries(cycles.map(c => [c.id, c]))
      setLastEvalScores(calcLastEvalScores(evals, cycleMap))
    }
    loadScores()
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [empModal, setEmpModal] = useState(null)      // null | { mode, emp }
  const [deleteModal, setDeleteModal] = useState(null) // null | { id, name }
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const filtered = useMemo(() => {
    let list = employees
    if (statusFilter) list = list.filter(e => e.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_number?.toLowerCase().includes(q) ||
        e.role?.toLowerCase().includes(q)
      )
    }
    return list
  }, [employees, search, statusFilter])

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteEmployee(deleteModal.id)
      setDeleteModal(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 className="page-title">Colaboradores</h1>
          {!loading && (
            <p className="page-subtitle">
              {employees.length} colaborador{employees.length !== 1 ? 'es' : ''}
            </p>
          )}
        </div>
        <button
          className="ui-btn primary"
          style={{ height: 36 }}
          onClick={() => setEmpModal({ mode: 'create', emp: null })}
        >
          <Plus size={14} />
          Novo Colaborador
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="emp-search">
          <Search size={14} className="emp-search-icon" />
          <input
            className="emp-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, número ou função…"
          />
          {search && (
            <button className="emp-search-clear" onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
        <div className="emp-filter-tabs">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value ?? 'all'}
              className={`emp-filter-tab${statusFilter === f.value ? ' active' : ''}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="ui-skeleton" style={{ height: 56 }} />
          ))}
        </div>
      ) : error ? (
        <p className="ui-error">{error}</p>
      ) : employees.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty-icon"><Users size={24} /></div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem colaboradores</p>
          <p style={{ fontSize: 13 }}>Adiciona o primeiro colaborador para começar.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ui-empty">
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem resultados</p>
          <p style={{ fontSize: 13 }}>Tenta ajustar a pesquisa ou o filtro.</p>
        </div>
      ) : (
        <EmployeeTable
          employees={filtered}
          lastEvalScores={lastEvalScores}
          onEdit={emp => setEmpModal({ mode: 'edit', emp })}
          onDelete={emp => { setDeleteError(''); setDeleteModal({ id: emp.id, name: emp.full_name }) }}
        />
      )}

      {/* Employee modal */}
      {empModal && (
        <EmployeeForm
          title={empModal.mode === 'create' ? 'Novo Colaborador' : 'Editar Colaborador'}
          initialValues={empModal.emp ?? {}}
          employees={employees}
          selfId={empModal.emp?.id}
          onSubmit={values =>
            empModal.mode === 'create'
              ? createEmployee(values)
              : updateEmployee(empModal.emp.id, values)
          }
          onClose={() => setEmpModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteModal && (
        <div
          className="ui-modal-overlay"
          onClick={e => e.target === e.currentTarget && setDeleteModal(null)}
        >
          <div className="ui-modal" style={{ maxWidth: 380 }}>
            <div className="ui-modal-header">
              <span className="ui-modal-title">Confirmar remoção</span>
              <button className="ui-modal-close" onClick={() => setDeleteModal(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="ui-modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
                Tem a certeza que quer apagar <strong>{deleteModal.name}</strong>?
              </p>
              {deleteError && <p className="ui-error">{deleteError}</p>}
            </div>
            <div className="ui-modal-footer">
              <button className="ui-btn secondary" onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className="ui-btn danger" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'A apagar…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
