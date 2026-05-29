import { useState } from 'react'
import { Plus, Building2, X } from 'lucide-react'
import { useDepartments } from '../hooks/useDepartments'
import DepartmentCard from '../components/departments/DepartmentCard'
import DepartmentForm from '../components/departments/DepartmentForm'
import TeamForm from '../components/departments/TeamForm'

export default function Departments() {
  const {
    departments, loading, error,
    createDepartment, updateDepartment, deleteDepartment,
    createTeam, updateTeam, deleteTeam,
  } = useDepartments()

  const [expanded, setExpanded] = useState(new Set())
  const [deptModal, setDeptModal] = useState(null)   // null | { mode, dept }
  const [teamModal, setTeamModal] = useState(null)   // null | { mode, departmentId, team }
  const [deleteModal, setDeleteModal] = useState(null) // null | { type, id, name }
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const toggleExpand = (id) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return
    setDeleting(true)
    setDeleteError('')
    try {
      if (deleteModal.type === 'dept') await deleteDepartment(deleteModal.id)
      else await deleteTeam(deleteModal.id)
      setDeleteModal(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const totalTeams = departments.reduce((n, d) => n + (d.teams?.length ?? 0), 0)

  return (
    <>
      <style>{`
        @keyframes dept-slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dept-modalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes dept-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* ── Card ── */
        .dept-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.2s, border-color 0.2s;
          animation: dept-slideIn 0.28s ease both;
        }
        .dept-card:hover { box-shadow: 0 2px 14px rgba(0,0,0,0.06); }
        .dept-card.expanded { border-color: var(--color-accent); }

        .dept-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 18px 18px 12px;
        }
        .dept-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: rgba(224,203,75,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #b8a738;
          flex-shrink: 0;
          margin-top: 1px;
        }
        [data-theme='dark'] .dept-icon {
          background: rgba(224,203,75,0.08);
          color: var(--color-accent);
        }
        .dept-info { flex: 1; min-width: 0; }
        .dept-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.1px;
        }
        .dept-desc {
          font-size: 12px;
          color: var(--color-text-muted);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dept-actions {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .dept-card:hover .dept-actions { opacity: 1; }
        .dept-action-btn {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
        }
        .dept-action-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .dept-action-btn.danger:hover { background: rgba(220,60,60,0.08); color: #e05252; }

        .dept-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px 14px;
        }
        .dept-team-count {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-muted);
        }
        .dept-expand-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
          padding: 4px 9px;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
        }
        .dept-expand-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .dept-card.expanded .dept-expand-btn { color: var(--color-accent); }

        /* ── Teams section ── */
        .dept-teams {
          border-top: 1px solid var(--color-border);
          background: var(--color-bg);
        }
        .dept-teams-inner {
          padding: 10px 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .team-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 8px;
          border-radius: 7px;
          transition: background 0.15s;
        }
        .team-row:hover { background: var(--color-surface); }
        .team-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-accent);
          flex-shrink: 0;
        }
        .team-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
        }
        .team-desc-text {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: 1px;
        }
        .team-actions {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .team-row:hover .team-actions { opacity: 1; }
        .team-action-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
        }
        .team-action-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .team-action-btn.danger:hover { background: rgba(220,60,60,0.08); color: #e05252; }
        .dept-add-team {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
          padding: 6px 8px;
          border-radius: 7px;
          margin-top: 4px;
          transition: background 0.15s, color 0.15s;
          width: 100%;
        }
        .dept-add-team:hover { background: rgba(224,203,75,0.08); color: var(--color-accent); }

        /* ── Skeleton ── */
        .dept-skeleton {
          height: 78px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }
        .dept-skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.035), transparent);
          animation: dept-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .dept-skeleton::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
        }

        /* ── Empty ── */
        .dept-empty {
          padding: 60px 24px;
          text-align: center;
          color: var(--color-text-muted);
        }
        .dept-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          background: var(--color-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          color: var(--color-muted);
        }

        /* ── Modal ── */
        .dept-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }
        .dept-modal {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          width: 100%;
          max-width: 440px;
          animation: dept-modalIn 0.22s cubic-bezier(0.16,1,0.3,1) both;
          box-shadow: 0 20px 60px rgba(0,0,0,0.14);
        }
        .dept-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 22px 0;
        }
        .dept-modal-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.2px;
        }
        .dept-modal-close {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.15s;
        }
        .dept-modal-close:hover { background: var(--color-hover); }
        .dept-modal-body {
          padding: 18px 22px 4px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .dept-field { display: flex; flex-direction: column; gap: 5px; }
        .dept-field label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .dept-input {
          height: 38px;
          padding: 0 11px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 13px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
          width: 100%;
        }
        .dept-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(224,203,75,0.1);
        }
        .dept-textarea {
          height: 72px;
          padding: 9px 11px;
          resize: none;
          line-height: 1.5;
        }
        .dept-error {
          font-size: 12px;
          color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12);
          border-radius: 6px;
          padding: 7px 11px;
        }
        .dept-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 22px 20px;
          margin-top: 14px;
          border-top: 1px solid var(--color-border);
        }
        .dept-btn {
          height: 34px;
          padding: 0 14px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: opacity 0.15s, background 0.15s;
        }
        .dept-btn.primary { background: var(--color-accent); color: var(--color-primary); }
        .dept-btn.primary:hover:not(:disabled) { opacity: 0.88; }
        .dept-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .dept-btn.secondary {
          background: transparent;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .dept-btn.secondary:hover { background: var(--color-hover); color: var(--color-text); }
        .dept-btn.danger {
          background: rgba(220,60,60,0.08);
          color: #e05252;
          border: 1px solid rgba(220,60,60,0.18);
        }
        .dept-btn.danger:hover:not(:disabled) { background: rgba(220,60,60,0.14); }
        .dept-btn.danger:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          gap: 16,
        }}>
          <div>
            <h1 className="page-title">Departamentos</h1>
            {!loading && (
              <p className="page-subtitle">
                {departments.length} departamento{departments.length !== 1 ? 's' : ''}
                {' · '}
                {totalTeams} equipa{totalTeams !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            className="dept-btn primary"
            style={{ height: 36, flexShrink: 0 }}
            onClick={() => setDeptModal({ mode: 'create', dept: null })}
          >
            <Plus size={14} />
            Novo Departamento
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} className="dept-skeleton" />)}
          </div>
        ) : error ? (
          <p className="dept-error">{error}</p>
        ) : departments.length === 0 ? (
          <div className="dept-empty">
            <div className="dept-empty-icon"><Building2 size={24} /></div>
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
              Sem departamentos
            </p>
            <p style={{ fontSize: 13 }}>Cria o primeiro departamento para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {departments.map((dept, i) => (
              <DepartmentCard
                key={dept.id}
                dept={dept}
                index={i}
                expanded={expanded.has(dept.id)}
                onToggle={() => toggleExpand(dept.id)}
                onEditDept={d => setDeptModal({ mode: 'edit', dept: d })}
                onDeleteDept={d => { setDeleteError(''); setDeleteModal({ type: 'dept', id: d.id, name: d.name }) }}
                onAddTeam={deptId => setTeamModal({ mode: 'create', departmentId: deptId, team: null })}
                onEditTeam={(team, deptId) => setTeamModal({ mode: 'edit', departmentId: deptId, team })}
                onDeleteTeam={team => { setDeleteError(''); setDeleteModal({ type: 'team', id: team.id, name: team.name }) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Department modal */}
      {deptModal && (
        <DepartmentForm
          title={deptModal.mode === 'create' ? 'Novo Departamento' : 'Editar Departamento'}
          initialValues={deptModal.dept ?? {}}
          onSubmit={values =>
            deptModal.mode === 'create'
              ? createDepartment(values)
              : updateDepartment(deptModal.dept.id, values)
          }
          onClose={() => setDeptModal(null)}
        />
      )}

      {/* Team modal */}
      {teamModal && (
        <TeamForm
          title={teamModal.mode === 'create' ? 'Nova Equipa' : 'Editar Equipa'}
          initialValues={teamModal.team ?? {}}
          onSubmit={values =>
            teamModal.mode === 'create'
              ? createTeam({ ...values, department_id: teamModal.departmentId })
              : updateTeam(teamModal.team.id, values)
          }
          onClose={() => setTeamModal(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div
          className="dept-modal-overlay"
          onClick={e => e.target === e.currentTarget && setDeleteModal(null)}
        >
          <div className="dept-modal" style={{ maxWidth: 380 }}>
            <div className="dept-modal-header">
              <span className="dept-modal-title">Confirmar remoção</span>
              <button className="dept-modal-close" onClick={() => setDeleteModal(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="dept-modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
                Tem a certeza que quer apagar{' '}
                <strong>{deleteModal.name}</strong>?
                {deleteModal.type === 'dept' &&
                  ' As equipas associadas serão também removidas.'}
              </p>
              {deleteError && <p className="dept-error">{deleteError}</p>}
            </div>
            <div className="dept-modal-footer">
              <button className="dept-btn secondary" onClick={() => setDeleteModal(null)}>
                Cancelar
              </button>
              <button
                className="dept-btn danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'A apagar…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
