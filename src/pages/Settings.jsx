import { useState, useEffect } from 'react'
import { Settings2, ListChecks, ShieldAlert, User, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import CriteriaSettings from '../components/settings/CriteriaSettings'
import GeneralSettings from '../components/settings/GeneralSettings'

function ProfileSection({ user, onSave }) {
  const current = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? ''
  const [name, setName]     = useState(current)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await onSave(name.trim())
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
      <div className="st-settings-field">
        <label className="st-settings-label">Nome de apresentação</label>
        <p className="st-settings-hint">
          Aparece na saudação do Dashboard. Só afecta a sua conta.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="st-input"
            style={{ width: 260 }}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="O seu nome"
            autoComplete="name"
          />
          <button
            className="st-save-btn"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saved
              ? <><Check size={13} /> Guardado</>
              : saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
          {user?.email}
        </p>
        {error && <p className="st-error" style={{ marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, updateDisplayName } = useAuth()
  const [criteria, setCriteria]   = useState([])
  const [settings, setSettings]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    const [criteriaRes, settingsRes] = await Promise.all([
      supabase.from('pf_criteria').select('*').order('sort_order'),
      supabase.from('pf_settings').select('*'),
    ])
    if (criteriaRes.error || settingsRes.error) {
      setLoadError(criteriaRes.error?.message ?? settingsRes.error?.message)
      setLoading(false)
      return
    }
    setCriteria(criteriaRes.data ?? [])
    const map = Object.fromEntries((settingsRes.data ?? []).map(s => [s.key, s.value]))
    setSettings(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleUpdateLabel = async (id, label) => {
    const { error } = await supabase.from('pf_criteria').update({ label }).eq('id', id)
    if (error) throw error
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, label } : c))
  }

  const handleReorder = async (newOrder) => {
    const updates = newOrder.map((c, i) =>
      supabase.from('pf_criteria').update({ sort_order: i + 1 }).eq('id', c.id)
    )
    const results = await Promise.all(updates)
    const err = results.find(r => r.error)?.error
    if (err) throw err
    setCriteria(newOrder.map((c, i) => ({ ...c, sort_order: i + 1 })))
  }

  const [activeTab, setActiveTab] = useState('perfil')

  const handleSaveSettings = async (values) => {
    const rows = Object.entries(values).map(([key, value]) => ({
      key, value, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('pf_settings').upsert(rows, { onConflict: 'key' })
    if (error) throw error
    setSettings(prev => ({ ...prev, ...values }))
  }

  return (
    <>
      <style>{`
        @keyframes st-fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes st-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* ── Sections ── */
        .st-section {
          margin-bottom: 32px;
          animation: st-fadeUp 0.28s ease both;
        }
        .st-section-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }
        .st-section-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .st-section-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.2px;
          margin-bottom: 3px;
        }
        .st-section-desc {
          font-size: 12px;
          color: var(--color-text-muted);
          line-height: 1.5;
        }
        .st-brc-notice {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          color: #c2570a;
          background: rgba(194,87,10,0.08);
          border: 1px solid rgba(194,87,10,0.15);
          border-radius: 6px;
          padding: 3px 8px;
          margin-top: 4px;
        }

        /* ── Card ── */
        .st-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 13px;
          overflow: hidden;
        }

        /* ── Criteria rows ── */
        .st-criteria-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 50px;
          border-bottom: 1px solid var(--color-border);
          transition: background 0.15s;
        }
        .st-criteria-row:last-child { border-bottom: none; }
        .st-criteria-row:hover { background: var(--color-hover); }
        .st-criteria-row.st-editing { background: var(--color-hover); }

        .st-criteria-num {
          width: 20px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          flex-shrink: 0;
          text-align: right;
        }
        .st-criteria-label {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          min-width: 0;
        }
        .st-criteria-actions {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .st-criteria-row:hover .st-criteria-actions { opacity: 1; }

        .st-action-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
        }
        .st-action-btn:hover:not(:disabled) { background: var(--color-border); color: var(--color-text); }
        .st-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .st-action-confirm:hover:not(:disabled) { background: rgba(34,197,94,0.12); color: #16a34a; }

        .st-edit-input {
          flex: 1;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--color-accent);
          border-radius: 7px;
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 13px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          box-shadow: 0 0 0 3px rgba(224,203,75,0.1);
          min-width: 0;
        }

        /* ── Settings fields ── */
        .st-settings-field {
          padding: 18px 20px;
        }
        .st-divider {
          border: none;
          border-top: 1px solid var(--color-border);
          margin: 0;
        }
        .st-settings-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 4px;
        }
        .st-settings-hint {
          font-size: 12px;
          color: var(--color-text-muted);
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .st-input {
          height: 36px;
          padding: 0 10px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 13px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: block;
        }
        .st-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(224,203,75,0.1);
        }
        select.st-input { cursor: pointer; }

        .st-settings-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 14px 20px;
          border-top: 1px solid var(--color-border);
          background: var(--color-bg);
        }
        .st-save-btn {
          height: 34px;
          padding: 0 16px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          background: var(--color-accent);
          color: var(--color-primary);
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: opacity 0.15s;
        }
        .st-save-btn:hover:not(:disabled) { opacity: 0.88; }
        .st-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Error ── */
        .st-error {
          font-size: 12px;
          color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12);
          border-radius: 6px;
          padding: 7px 11px;
        }

        /* ── Tabs ── */
        .st-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-hover);
          border-radius: 9px;
          width: fit-content;
          margin-bottom: 28px;
        }
        .st-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 15px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .st-tab:hover { color: var(--color-text); }
        .st-tab.active {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }

        /* ── Skeleton ── */
        .st-skeleton {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 13px;
          overflow: hidden;
          position: relative;
        }
        .st-skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent);
          animation: st-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .st-skeleton::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
        }
      `}</style>

      <div>
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 className="page-title">Definições</h1>
          <p className="page-subtitle">Configuração de critérios e parâmetros globais da aplicação.</p>
        </div>

        {loadError && <p className="st-error" style={{ marginBottom: 24 }}>{loadError}</p>}

        <div className="st-tabs">
          <button
            className={`st-tab${activeTab === 'perfil' ? ' active' : ''}`}
            onClick={() => setActiveTab('perfil')}
          >
            <User size={14} /> Perfil
          </button>
          <button
            className={`st-tab${activeTab === 'criterios' ? ' active' : ''}`}
            onClick={() => setActiveTab('criterios')}
          >
            <ListChecks size={14} /> Critérios de Avaliação
          </button>
          <button
            className={`st-tab${activeTab === 'geral' ? ' active' : ''}`}
            onClick={() => setActiveTab('geral')}
          >
            <Settings2 size={14} /> Configurações Gerais
          </button>
        </div>

        {activeTab === 'perfil' && (
          <div className="st-section">
            <div className="st-section-header">
              <div className="st-section-icon" style={{ background: 'rgba(34,197,94,0.08)', color: '#16a34a' }}>
                <User size={16} />
              </div>
              <div>
                <div className="st-section-title">O Meu Perfil</div>
                <div className="st-section-desc">
                  Nome de apresentação usado na saudação do Dashboard.
                </div>
              </div>
            </div>
            <ProfileSection user={user} onSave={updateDisplayName} />
          </div>
        )}

        {activeTab === 'criterios' && (
          <div className="st-section">
            <div className="st-section-header">
              <div className="st-section-icon" style={{ background: 'rgba(45,100,200,0.08)', color: '#3b74d4' }}>
                <ListChecks size={16} />
              </div>
              <div>
                <div className="st-section-title">Critérios de Avaliação</div>
                <div className="st-section-desc">
                  Edita os labels e reordena conforme necessário.
                </div>
                <div className="st-brc-notice">
                  <ShieldAlert size={11} />
                  Requisito BRC — critérios não podem ser eliminados
                </div>
              </div>
            </div>

            {loading ? (
              <div className="st-skeleton" style={{ height: 8 * 50 }} />
            ) : (
              <CriteriaSettings
                criteria={criteria}
                onUpdateLabel={handleUpdateLabel}
                onReorder={handleReorder}
              />
            )}
          </div>
        )}

        {activeTab === 'geral' && (
          <div className="st-section">
            <div className="st-section-header">
              <div className="st-section-icon" style={{ background: 'rgba(100,60,200,0.08)', color: '#7c50d4' }}>
                <Settings2 size={16} />
              </div>
              <div>
                <div className="st-section-title">Configurações Gerais</div>
                <div className="st-section-desc">
                  Parâmetros globais usados na geração automática de avaliações e na criação de ciclos.
                </div>
              </div>
            </div>

            {loading ? (
              <div className="st-skeleton" style={{ height: 220 }} />
            ) : (
              <GeneralSettings
                settings={settings}
                onSave={handleSaveSettings}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}
