import { useState, useMemo } from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import { useCycles } from '../hooks/useCycles'
import CycleCard from '../components/cycles/CycleCard'
import CycleForm from '../components/cycles/CycleForm'

const STATUS_FILTERS = [
  { value: 'all',    label: 'Todos' },
  { value: 'draft',  label: 'Rascunho' },
  { value: 'active', label: 'Ativos' },
  { value: 'closed', label: 'Fechados' },
]

export default function Cycles() {
  const { cycles, loading, error, createCycle, updateCycle, deleteCycle } = useCycles()

  const [filter, setFilter]           = useState('all')
  const [cycleModal, setCycleModal]   = useState(null)  // null | { mode, cycle }
  const [deleteModal, setDeleteModal] = useState(null)  // null | { cycle }
  const [confirmModal, setConfirmModal] = useState(null) // null | { type: 'activate'|'close', cycle }
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [acting, setActing]           = useState(false)
  const [actError, setActError]       = useState('')

  const hasActiveCycle = useMemo(() => cycles.some(c => c.status === 'active'), [cycles])

  const filtered = useMemo(() =>
    filter === 'all' ? cycles : cycles.filter(c => c.status === filter),
    [cycles, filter]
  )

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteCycle(deleteModal.cycle.id)
      setDeleteModal(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmModal) return
    setActing(true)
    setActError('')
    try {
      const newStatus = confirmModal.type === 'activate' ? 'active' : 'closed'
      await updateCycle(confirmModal.cycle.id, { status: newStatus })
      setConfirmModal(null)
    } catch (err) {
      setActError(err.message)
    } finally {
      setActing(false)
    }
  }

  const counts = useMemo(() => ({
    draft:  cycles.filter(c => c.status === 'draft').length,
    active: cycles.filter(c => c.status === 'active').length,
    closed: cycles.filter(c => c.status === 'closed').length,
  }), [cycles])

  return (
    <>
      <style>{`
        @keyframes cy-slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cy-modalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cy-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* ── Card ── */
        .cy-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.2s, border-color 0.2s;
          animation: cy-slideIn 0.26s ease both;
        }
        .cy-card:hover { box-shadow: 0 2px 14px rgba(0,0,0,0.06); }
        .cy-card-active { border-color: #16a34a; box-shadow: 0 0 0 1px rgba(34,197,94,0.12); }

        .cy-card-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          gap: 16px;
        }
        .cy-card-left { flex: 1; min-width: 0; }
        .cy-card-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .cy-card-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.1px;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cy-card-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .cy-meta-sep { opacity: 0.35; }
        .cy-card-type { font-weight: 500; }
        .cy-card-dates, .cy-card-anon { display: inline-flex; align-items: center; }

        .cy-card-actions {
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .cy-card:hover .cy-card-actions { opacity: 1; }

        .cy-action-btn {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
        }
        .cy-action-btn:hover { background: var(--color-hover); color: var(--color-text); }
        .cy-action-activate:hover { background: rgba(34,197,94,0.1); color: #16a34a; }
        .cy-action-close:hover { background: rgba(91,111,160,0.1); color: #5b6fa0; }
        .cy-action-danger:hover { background: rgba(220,60,60,0.08); color: #e05252; }

        /* ── Filter tabs ── */
        .cy-filter-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-hover);
          border-radius: 9px;
          width: fit-content;
        }
        .cy-filter-tab {
          padding: 5px 13px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .cy-filter-tab:hover { color: var(--color-text); }
        .cy-filter-tab.active {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }

        /* ── Skeleton ── */
        .cy-skeleton {
          height: 68px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }
        .cy-skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent);
          animation: cy-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .cy-skeleton::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
        }

        /* ── Empty ── */
        .cy-empty {
          padding: 64px 24px;
          text-align: center;
          color: var(--color-text-muted);
        }
        .cy-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          background: var(--color-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          color: var(--color-text-muted);
        }

        /* ── Modal ── */
        .cy-overlay {
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
        .cy-modal {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          width: 100%;
          max-width: 480px;
          animation: cy-modalIn 0.22s cubic-bezier(0.16,1,0.3,1) both;
          box-shadow: 0 20px 60px rgba(0,0,0,0.14);
        }
        .cy-modal-sm { max-width: 380px; }
        .cy-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 22px 0;
        }
        .cy-modal-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.2px;
        }
        .cy-modal-close {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.15s;
        }
        .cy-modal-close:hover { background: var(--color-hover); }
        .cy-modal-body {
          padding: 18px 22px 4px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .cy-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 22px 20px;
          margin-top: 14px;
          border-top: 1px solid var(--color-border);
        }

        /* ── Form fields ── */
        .cy-field { display: flex; flex-direction: column; gap: 5px; }
        .cy-field label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .cy-input {
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
        .cy-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(224,203,75,0.1);
        }
        select.cy-input { cursor: pointer; }

        /* ── Toggle ── */
        .cy-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid var(--color-border);
          border-radius: 9px;
          cursor: pointer;
          transition: background 0.15s;
          user-select: none;
        }
        .cy-toggle-row:hover { background: var(--color-hover); }
        .cy-toggle {
          width: 38px;
          height: 22px;
          border-radius: 11px;
          background: var(--color-border);
          position: relative;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .cy-toggle-on { background: var(--color-accent); }
        .cy-toggle-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }
        .cy-toggle-on .cy-toggle-knob { transform: translateX(16px); }

        /* ── Alerts ── */
        .cy-warn {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 7px;
          font-size: 12px;
          background: rgba(234,179,8,0.08);
          border: 1px solid rgba(234,179,8,0.2);
          color: #a16207;
        }
        [data-theme='dark'] .cy-warn { color: #ca8a04; }
        .cy-error {
          font-size: 12px;
          color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12);
          border-radius: 6px;
          padding: 7px 11px;
        }

        /* ── Buttons ── */
        .cy-btn {
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
        .cy-btn-primary { background: var(--color-accent); color: var(--color-primary); }
        .cy-btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .cy-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .cy-btn-secondary {
          background: transparent;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .cy-btn-secondary:hover { background: var(--color-hover); color: var(--color-text); }
        .cy-btn-danger {
          background: rgba(220,60,60,0.08);
          color: #e05252;
          border: 1px solid rgba(220,60,60,0.18);
        }
        .cy-btn-danger:hover:not(:disabled) { background: rgba(220,60,60,0.14); }
        .cy-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .cy-btn-green {
          background: rgba(34,197,94,0.1);
          color: #16a34a;
          border: 1px solid rgba(34,197,94,0.2);
        }
        .cy-btn-green:hover:not(:disabled) { background: rgba(34,197,94,0.16); }
        .cy-btn-green:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
          <div>
            <h1 className="page-title">Ciclos de Avaliação</h1>
            {!loading && (
              <p className="page-subtitle">
                {cycles.length} ciclo{cycles.length !== 1 ? 's' : ''}
                {counts.active > 0 && <> · <span style={{ color: '#16a34a', fontWeight: 600 }}>1 ativo</span></>}
              </p>
            )}
          </div>
          <button
            className="cy-btn cy-btn-primary"
            style={{ height: 36, flexShrink: 0 }}
            onClick={() => setCycleModal({ mode: 'create', cycle: null })}
          >
            <Plus size={14} />
            Novo Ciclo
          </button>
        </div>

        {/* Filter tabs */}
        {!loading && cycles.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="cy-filter-tabs">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`cy-filter-tab${filter === f.value ? ' active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                  {f.value !== 'all' && counts[f.value] > 0 && (
                    <span style={{ marginLeft: 5, opacity: 0.6 }}>({counts[f.value]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} className="cy-skeleton" />)}
          </div>
        ) : error ? (
          <p className="cy-error">{error}</p>
        ) : cycles.length === 0 ? (
          <div className="cy-empty">
            <div className="cy-empty-icon"><RefreshCw size={22} /></div>
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem ciclos</p>
            <p style={{ fontSize: 13 }}>Cria o primeiro ciclo de avaliação para começar.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cy-empty">
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Sem resultados</p>
            <p style={{ fontSize: 13 }}>Não há ciclos com este estado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(cycle => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                onEdit={c => setCycleModal({ mode: 'edit', cycle: c })}
                onDelete={c => { setDeleteError(''); setDeleteModal({ cycle: c }) }}
                onActivate={c => { setActError(''); setConfirmModal({ type: 'activate', cycle: c }) }}
                onCloseCycle={c => { setActError(''); setConfirmModal({ type: 'close', cycle: c }) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {cycleModal && (
        <CycleForm
          title={cycleModal.mode === 'create' ? 'Novo Ciclo' : 'Editar Ciclo'}
          initialValues={cycleModal.cycle ?? {}}
          hasActiveCycle={hasActiveCycle}
          onSubmit={values =>
            cycleModal.mode === 'create'
              ? createCycle(values)
              : updateCycle(cycleModal.cycle.id, values)
          }
          onClose={() => setCycleModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteModal && (
        <div className="cy-overlay" onClick={e => e.target === e.currentTarget && setDeleteModal(null)}>
          <div className="cy-modal cy-modal-sm">
            <div className="cy-modal-header">
              <span className="cy-modal-title">Confirmar remoção</span>
              <button className="cy-modal-close" onClick={() => setDeleteModal(null)}><X size={15} /></button>
            </div>
            <div className="cy-modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
                Tem a certeza que quer apagar <strong>{deleteModal.cycle.name}</strong>?
              </p>
              {deleteError && <p className="cy-error">{deleteError}</p>}
            </div>
            <div className="cy-modal-footer">
              <button className="cy-btn cy-btn-secondary" onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className="cy-btn cy-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'A apagar…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate / Close confirmation */}
      {confirmModal && (
        <div className="cy-overlay" onClick={e => e.target === e.currentTarget && setConfirmModal(null)}>
          <div className="cy-modal cy-modal-sm">
            <div className="cy-modal-header">
              <span className="cy-modal-title">
                {confirmModal.type === 'activate' ? 'Ativar ciclo' : 'Fechar ciclo'}
              </span>
              <button className="cy-modal-close" onClick={() => setConfirmModal(null)}><X size={15} /></button>
            </div>
            <div className="cy-modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
                {confirmModal.type === 'activate' ? (
                  <>
                    Ativar <strong>{confirmModal.cycle.name}</strong>?
                    {hasActiveCycle && (
                      <span style={{ display: 'block', marginTop: 8, color: 'var(--color-text-muted)' }}>
                        O ciclo actualmente activo será movido para Rascunho.
                      </span>
                    )}
                  </>
                ) : (
                  <>Fechar <strong>{confirmModal.cycle.name}</strong>? Esta acção não pode ser desfeita.</>
                )}
              </p>
              {actError && <p className="cy-error">{actError}</p>}
            </div>
            <div className="cy-modal-footer">
              <button className="cy-btn cy-btn-secondary" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button
                className={`cy-btn ${confirmModal.type === 'activate' ? 'cy-btn-green' : 'cy-btn-danger'}`}
                onClick={handleConfirmAction}
                disabled={acting}
              >
                {acting
                  ? (confirmModal.type === 'activate' ? 'A ativar…' : 'A fechar…')
                  : (confirmModal.type === 'activate' ? 'Ativar' : 'Fechar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
