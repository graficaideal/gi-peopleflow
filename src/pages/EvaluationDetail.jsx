import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, User, Users, UserCheck, Link2, Copy, Mail } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import EvaluationForm from '../components/evaluations/EvaluationForm'
import EvaluationSummary from '../components/evaluations/EvaluationSummary'
import { EvaluationTypeBadge, EvaluationStatusBadge } from '../components/evaluations/EvaluationBadge'
import { formatDate } from '../utils/formatters'

const TYPE_ICON = { self: User, peer: Users, manager: UserCheck }

const EVAL_BASE_URL = 'https://gi-peopleflow.vercel.app/avaliar'

export default function EvaluationDetail() {
  const { id } = useParams()
  const [evaluation, setEvaluation] = useState(null)
  const [criteria, setCriteria]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [localToken, setLocalToken] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [evalResult, criteriaResult] = await Promise.all([
      supabase.from('pf_evaluations').select(`
        *,
        cycle:pf_evaluation_cycles(id, name, anonymous, status, end_date),
        evaluatee:pf_employees!evaluatee_id(id, full_name, employee_number, role),
        evaluator:pf_employees!evaluator_id(id, full_name, employee_number, email),
        answers:pf_evaluation_answers(id, criteria_id, score)
      `).eq('id', id).single(),
      supabase.from('pf_criteria').select('*').eq('active', true).order('sort_order'),
    ])
    if (evalResult.error) { setError(evalResult.error.message); setLoading(false); return }
    setEvaluation(evalResult.data)
    setCriteria(criteriaResult.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleGenerateToken = async () => {
    setGenerating(true)
    try {
      const token = crypto.randomUUID()
      const expiresAt = cycle?.end_date
        ? new Date(cycle.end_date + 'T23:59:59').toISOString()
        : null
      const { error: err } = await supabase
        .from('pf_evaluations')
        .update({ token, token_expires_at: expiresAt, status: 'sent' })
        .eq('id', id)
      if (err) throw err
      setLocalToken(token)
      setEvaluation(ev => ({ ...ev, token, token_expires_at: expiresAt, status: 'sent' }))
    } catch (err) {
      console.error('Erro ao gerar token:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyLink = () => {
    const token = localToken || evaluation?.token
    if (!token) return
    navigator.clipboard.writeText(`${EVAL_BASE_URL}/${token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendEmail = () => {
    const token = localToken || evaluation?.token
    if (!token) return
    const link = `${EVAL_BASE_URL}/${token}`
    const endDate = cycle?.end_date
      ? new Date(cycle.end_date + 'T00:00:00').toLocaleDateString('pt-PT')
      : '—'
    const subject = encodeURIComponent(`Avaliação de Desempenho - ${evaluatee?.full_name ?? ''}`)
    const body = encodeURIComponent(
      `Olá ${evaluator?.full_name ?? ''},\n\nFoi gerada a sua avaliação de desempenho referente ao ciclo ${cycle?.name ?? ''}. Por favor aceda ao link abaixo para preencher o questionário até ${endDate}.\n\n${link}`
    )
    window.open(`mailto:${evaluator?.email ?? ''}?subject=${subject}&body=${body}`)
  }

  const handleSubmit = async ({ scores, notes }) => {
    const answers = Object.entries(scores).map(([criteria_id, score]) => ({
      evaluation_id: id,
      criteria_id,
      score,
    }))

    const { error: answersErr } = await supabase
      .from('pf_evaluation_answers')
      .upsert(answers, { onConflict: 'evaluation_id,criteria_id' })
    if (answersErr) throw answersErr

    const { error: evalErr } = await supabase
      .from('pf_evaluations')
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), notes })
      .eq('id', id)
    if (evalErr) throw evalErr

    await load()
  }

  const BackLink = () => (
    <Link
      to="/evaluations"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24,
        transition: 'color 0.15s',
      }}
    >
      <ArrowLeft size={14} /> Avaliações
    </Link>
  )

  if (loading) return (
    <div>
      <BackLink />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="ui-skeleton" style={{ height: 96 }} />
        <div className="ui-skeleton" style={{ height: 320 }} />
      </div>
    </div>
  )

  if (error || !evaluation) return (
    <div>
      <BackLink />
      <p className="ui-error">{error ?? 'Avaliação não encontrada.'}</p>
    </div>
  )

  const cycle     = Array.isArray(evaluation.cycle)     ? evaluation.cycle[0]     : evaluation.cycle
  const evaluatee = Array.isArray(evaluation.evaluatee) ? evaluation.evaluatee[0] : evaluation.evaluatee
  const evaluator = Array.isArray(evaluation.evaluator) ? evaluation.evaluator[0] : evaluation.evaluator

  const isAnonymousPeer = evaluation.type === 'peer' && cycle?.anonymous
  const canEdit = evaluation.status === 'pending' && cycle?.status === 'active'
  const TypeIcon = TYPE_ICON[evaluation.type] ?? User

  return (
    <>
      <style>{`
        /* ── Criteria rows ── */
        .cr-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 14px 0;
          border-bottom: 1px solid var(--color-border);
        }
        .cr-row:last-child { border-bottom: none; }
        .cr-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          flex: 1;
          min-width: 0;
        }
        .cr-scores {
          display: flex;
          gap: 5px;
          flex-shrink: 0;
        }
        .cr-score-btn {
          width: 58px;
          height: 50px;
          border-radius: 9px;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .cr-score-btn:hover {
          border-color: var(--color-accent);
          background: rgba(224,203,75,0.05);
        }
        .cr-score-btn.cr-selected {
          background: var(--color-accent);
          border-color: var(--color-accent);
        }
        .cr-num {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          line-height: 1;
        }
        .cr-lbl {
          font-size: 9px;
          font-weight: 500;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2px;
          text-align: center;
          line-height: 1.2;
        }
        .cr-selected .cr-num,
        .cr-selected .cr-lbl { color: var(--color-primary); }

        /* ── Evaluation layout ── */
        .ev-criteria-list {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 4px 18px;
          margin-bottom: 16px;
        }
        .ev-notes-section { margin-bottom: 16px; }
        .ev-field-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 6px;
        }
        .ev-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--color-border);
          border-radius: 9px;
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 13px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          transition: border-color 0.15s;
          line-height: 1.5;
        }
        .ev-textarea:focus { border-color: var(--color-accent); }

        .ev-live-avg {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 11px;
          margin-bottom: 16px;
        }
        .ev-avg-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 11px;
          margin-top: 16px;
        }
        .ev-avg-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ev-notes-box {
          padding: 14px 18px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 11px;
          margin-top: 16px;
        }
        .ev-box-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 6px;
        }
        .ev-notes-text {
          font-size: 13px;
          color: var(--color-text);
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .ev-error {
          font-size: 12px;
          color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.12);
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }
        .ev-submit-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 4px;
        }
        .ev-btn {
          height: 38px;
          padding: 0 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: opacity 0.15s;
        }
        .ev-btn-primary { background: var(--color-accent); color: var(--color-primary); }
        .ev-btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .ev-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Info cards ── */
        .ev-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
          margin-bottom: 28px;
        }
        .ev-info-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 11px;
          padding: 14px 16px;
        }
        .ev-info-card-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 4px;
        }
        .ev-info-card-value {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
        }

        /* ── Notice ── */
        .ev-notice {
          padding: 14px 18px;
          background: rgba(91,111,160,0.06);
          border: 1px solid rgba(91,111,160,0.15);
          border-radius: 10px;
          font-size: 13px;
          color: #5b6fa0;
          margin-bottom: 20px;
        }

        /* ── Token section ── */
        .ev-token-card {
          padding: 14px 18px;
          background: rgba(224,203,75,0.05);
          border: 1px solid rgba(224,203,75,0.2);
          border-radius: 11px;
          margin-bottom: 20px;
        }
        .ev-token-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .ev-token-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ev-token-btn {
          height: 34px;
          padding: 0 14px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .ev-token-btn:hover { background: var(--color-hover); border-color: var(--color-accent); }
        .ev-token-btn--copied {
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.3);
          color: #16a34a;
        }
        .ev-token-generate {
          height: 36px;
          padding: 0 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          border: none;
          background: var(--color-accent);
          color: var(--color-primary);
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: opacity 0.15s;
          margin-bottom: 20px;
        }
        .ev-token-generate:hover:not(:disabled) { opacity: 0.88; }
        .ev-token-generate:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>

      <div>
        <BackLink />

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(224,203,75,0.1)', color: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <TypeIcon size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.3px' }}>
                  {evaluatee?.full_name ?? '—'}
                </h1>
                <EvaluationTypeBadge type={evaluation.type} />
                <EvaluationStatusBadge status={evaluation.status} />
              </div>
              {cycle?.name && (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {cycle.name}
                  {evaluation.submitted_at && ` · Submetida em ${formatDate(evaluation.submitted_at)}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="ev-info-grid">
          <div className="ev-info-card">
            <div className="ev-info-card-label">Avaliado</div>
            <div className="ev-info-card-value">{evaluatee?.full_name ?? '—'}</div>
            {evaluatee?.role && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{evaluatee.role}</div>
            )}
          </div>
          <div className="ev-info-card">
            <div className="ev-info-card-label">Avaliador</div>
            <div className="ev-info-card-value">
              {isAnonymousPeer ? (
                <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>Anónimo</span>
              ) : (evaluator?.full_name ?? '—')}
            </div>
          </div>
          <div className="ev-info-card">
            <div className="ev-info-card-label">Ciclo</div>
            <div className="ev-info-card-value">{cycle?.name ?? '—'}</div>
          </div>
          {evaluation.status === 'submitted' && evaluation.submitted_at && (
            <div className="ev-info-card">
              <div className="ev-info-card-label">Submetida em</div>
              <div className="ev-info-card-value">{formatDate(evaluation.submitted_at)}</div>
            </div>
          )}
        </div>

        {/* Token link section */}
        {(evaluation.status === 'pending' || evaluation.status === 'sent') && (() => {
          const displayToken = localToken || evaluation.token
          if (displayToken) {
            return (
              <div className="ev-token-card">
                <div className="ev-token-label">
                  <Link2 size={13} color="var(--color-accent)" />
                  Link de avaliação gerado
                </div>
                <div className="ev-token-actions">
                  <button
                    className={`ev-token-btn${copied ? ' ev-token-btn--copied' : ''}`}
                    onClick={handleCopyLink}
                  >
                    <Copy size={13} />
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </button>
                  <button className="ev-token-btn" onClick={handleSendEmail}>
                    <Mail size={13} />
                    Enviar Email
                  </button>
                </div>
              </div>
            )
          }
          return (
            <button
              className="ev-token-generate"
              onClick={handleGenerateToken}
              disabled={generating}
            >
              <Link2 size={14} />
              {generating ? 'A gerar…' : 'Gerar Link de Avaliação'}
            </button>
          )
        })()}

        {/* Notice if cycle not active but evaluation is pending */}
        {evaluation.status === 'pending' && cycle?.status !== 'active' && (
          <div className="ev-notice">
            Este ciclo não está activo. A avaliação não pode ser preenchida no momento.
          </div>
        )}

        {/* Section title */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>
          Critérios de avaliação
        </div>

        {/* Form or Summary */}
        {canEdit ? (
          <EvaluationForm
            evaluation={evaluation}
            criteria={criteria}
            onSubmit={handleSubmit}
          />
        ) : (
          <EvaluationSummary
            evaluation={evaluation}
            criteria={criteria}
          />
        )}
      </div>
    </>
  )
}
