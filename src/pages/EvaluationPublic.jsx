import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { SCORE_LABELS, EVALUATION_TYPE_LABELS } from '../lib/constants'
import { formatDate } from '../utils/formatters'

function avgColor(v) {
  if (!v) return 'var(--color-text-muted)'
  if (v <= 2) return '#e05252'
  if (v <= 3) return '#ca8a04'
  return '#16a34a'
}

export default function EvaluationPublic() {
  const { token } = useParams()
  const [pageState, setPageState] = useState('loading')
  const [evaluation, setEvaluation] = useState(null)
  const [criteria, setCriteria]     = useState([])
  const [scores, setScores]         = useState({})
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [submitError, setSubmitError] = useState('')

  const load = useCallback(async () => {
    const [evalRes, criteriaRes] = await Promise.all([
      supabase
        .from('pf_evaluations')
        .select(`
          id, type, status, token, token_expires_at, notes,
          cycle:pf_evaluation_cycles(id, name, end_date),
          evaluatee:pf_employees!evaluatee_id(id, full_name, role),
          answers:pf_evaluation_answers(id, criteria_id, score)
        `)
        .eq('token', token)
        .single(),
      supabase.from('pf_criteria').select('*').eq('active', true).order('sort_order'),
    ])

    if (evalRes.error || !evalRes.data) { setPageState('invalid'); return }

    const ev = evalRes.data
    if (ev.token_expires_at && new Date(ev.token_expires_at) < new Date()) {
      setPageState('expired'); return
    }
    if (ev.status === 'submitted')  { setPageState('already_submitted'); return }
    if (ev.status === 'cancelled')  { setPageState('invalid'); return }

    if (ev.status === 'pending' || ev.status === 'sent') {
      const { error: updateErr } = await supabase
        .from('pf_evaluations')
        .update({ status: 'opened' })
        .eq('id', ev.id)
      if (updateErr) { setPageState('invalid'); return }
    }

    setEvaluation(ev)
    setCriteria(criteriaRes.data ?? [])
    setScores(Object.fromEntries((ev.answers ?? []).map(a => [a.criteria_id, a.score])))
    setNotes(ev.notes ?? '')
    setPageState('form')
  }, [token])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const filled = criteria.map(c => scores[c.id]).filter(Boolean)
    if (filled.length < criteria.length) {
      setSubmitError('Preenche todos os critérios antes de submeter.')
      return
    }
    setSaving(true)
    setSubmitError('')

    const answers = Object.entries(scores).map(([criteria_id, score]) => ({
      criteria_id,
      score: Number(score),
    }))

    const { error } = await supabase.rpc('submit_evaluation', {
      p_token:   token,
      p_answers: answers,
      p_notes:   notes.trim() || null,
    })

    if (error) { setSubmitError(error.message); setSaving(false); return }
    setPageState('success')
  }

  const cycle     = evaluation ? (Array.isArray(evaluation.cycle)     ? evaluation.cycle[0]     : evaluation.cycle)     : null
  const evaluatee = evaluation ? (Array.isArray(evaluation.evaluatee) ? evaluation.evaluatee[0] : evaluation.evaluatee) : null

  const scoreValues = criteria.map(c => scores[c.id]).filter(Boolean)
  const avg = scoreValues.length
    ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
    : null
  const progress = criteria.length > 0 ? scoreValues.length / criteria.length : 0

  return (
    <>
      <style>{`
        /* ── Base ── */
        .pub-page {
          min-height: 100vh;
          background: var(--color-bg);
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--color-text);
        }

        /* ── Header ── */
        .pub-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .pub-header-logo { width: 26px; height: auto; flex-shrink: 0; }
        .pub-header-name { font-size: 15px; font-weight: 700; color: var(--color-text); letter-spacing: -0.3px; }
        .pub-header-dot  { font-size: 13px; color: var(--color-text-muted); }

        /* ── Main ── */
        .pub-main {
          max-width: 680px;
          margin: 28px auto;
          padding: 0 16px 80px;
        }

        /* ── Cards ── */
        .pub-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          padding: 22px 24px;
          margin-bottom: 14px;
        }

        .pub-section-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 4px;
        }

        /* ── Progress bar ── */
        .pub-progress {
          height: 3px;
          background: var(--color-hover);
          border-radius: 2px;
          margin-bottom: 18px;
          overflow: hidden;
        }
        .pub-progress-fill {
          height: 100%;
          background: var(--color-accent);
          border-radius: 2px;
          transition: width 0.35s ease;
        }
        .pub-progress-label {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pub-progress-count {
          font-weight: 600;
          color: var(--color-accent);
          font-size: 12px;
        }

        /* ── Criteria rows — desktop ── */
        .pub-cr-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid var(--color-border);
        }
        .pub-cr-row:last-child { border-bottom: none; }

        .pub-cr-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          flex: 1;
          min-width: 0;
          line-height: 1.4;
        }

        .pub-cr-scores { display: flex; gap: 5px; flex-shrink: 0; }

        .pub-cr-btn {
          width: 56px;
          height: 52px;
          border-radius: 10px;
          border: 1.5px solid var(--color-border);
          background: var(--color-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          transition: border-color 0.12s, background 0.12s, transform 0.1s, box-shadow 0.12s;
        }
        .pub-cr-btn:hover {
          border-color: var(--color-accent);
          background: rgba(224,203,75,0.06);
        }
        .pub-cr-btn.selected {
          background: var(--color-accent);
          border-color: var(--color-accent);
          transform: scale(1.04);
          box-shadow: 0 2px 10px rgba(224,203,75,0.25);
        }
        .pub-cr-btn:active { transform: scale(0.96); }

        .pub-cr-num {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          line-height: 1;
        }
        .pub-cr-lbl {
          font-size: 8px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2px;
          text-align: center;
          line-height: 1.2;
        }
        .pub-cr-btn.selected .pub-cr-num,
        .pub-cr-btn.selected .pub-cr-lbl { color: var(--color-primary); }

        /* ── Notes ── */
        .pub-textarea {
          width: 100%;
          padding: 11px 13px;
          border: 1.5px solid var(--color-border);
          border-radius: 10px;
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 14px;
          font-family: inherit;
          outline: none;
          resize: vertical;
          line-height: 1.6;
          transition: border-color 0.15s;
          -webkit-appearance: none;
        }
        .pub-textarea:focus { border-color: var(--color-accent); }
        .pub-textarea::placeholder { color: var(--color-text-muted); }

        /* ── Average ── */
        .pub-avg-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: var(--color-hover);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          margin-bottom: 14px;
        }

        /* ── Submit row ── */
        .pub-submit-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pub-submit-btn {
          height: 46px;
          padding: 0 28px;
          border-radius: 11px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          border: none;
          background: var(--color-accent);
          color: var(--color-primary);
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 0.15s, transform 0.1s;
          letter-spacing: 0.1px;
        }
        .pub-submit-btn:hover:not(:disabled) { opacity: 0.88; }
        .pub-submit-btn:active:not(:disabled) { transform: scale(0.98); }
        .pub-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Error ── */
        .pub-error {
          font-size: 13px;
          color: #e05252;
          background: rgba(220,60,60,0.08);
          border: 1px solid rgba(220,60,60,0.18);
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 14px;
          line-height: 1.5;
        }

        /* ── State pages ── */
        .pub-state-box { text-align: center; padding: 48px 20px; }
        .pub-state-icon {
          width: 60px; height: 60px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px; font-size: 28px;
        }
        .pub-state-title { font-size: 20px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
        .pub-state-msg   { font-size: 14px; color: var(--color-text-muted); line-height: 1.65; }

        /* ── Mobile ── */
        @media (max-width: 600px) {
          .pub-header { padding: 12px 16px; }

          .pub-main { margin: 14px auto; padding: 0 12px 80px; }

          .pub-card { padding: 18px 16px; border-radius: 12px; }

          /* Stack label above score buttons */
          .pub-cr-row {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 16px 0;
          }

          .pub-cr-label {
            font-size: 14px;
            font-weight: 600;
          }

          /* 5-column grid filling card width */
          .pub-cr-scores {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
          }

          .pub-cr-btn {
            width: 100%;
            height: 56px;
            border-radius: 10px;
            border-width: 1.5px;
          }
          .pub-cr-num { font-size: 17px; }
          .pub-cr-lbl { font-size: 7.5px; display: block; letter-spacing: 0; }

          /* Full-width submit */
          .pub-submit-row {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .pub-submit-btn {
            width: 100%;
            height: 52px;
            font-size: 15px;
            border-radius: 12px;
          }

          .pub-avg-row { padding: 12px 14px; }
        }

        /* Very small screens (iPhone SE, 320px) */
        @media (max-width: 360px) {
          .pub-cr-btn { height: 50px; }
          .pub-cr-num { font-size: 15px; }
          .pub-cr-lbl { display: none; }
        }
      `}</style>

      <div className="pub-page" data-theme="dark">
        <header className="pub-header">
          <img src="/logo.svg" alt="GI" className="pub-header-logo" />
          <span className="pub-header-name">PeopleFlow</span>
          <span className="pub-header-dot">· GI</span>
        </header>

        <main className="pub-main">
          {pageState === 'loading' && (
            <div className="pub-card pub-state-box">
              <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>A carregar…</div>
            </div>
          )}

          {pageState === 'invalid' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: 'rgba(220,60,60,0.12)' }}>🔗</div>
              <div className="pub-state-title">Link inválido</div>
              <div className="pub-state-msg">Este link não existe ou foi removido.</div>
            </div>
          )}

          {pageState === 'expired' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: 'rgba(202,138,4,0.12)' }}>⏱</div>
              <div className="pub-state-title">Link expirado</div>
              <div className="pub-state-msg">
                O prazo para preencher esta avaliação terminou.
                {cycle?.end_date && <> Prazo era {formatDate(cycle.end_date)}.</>}
              </div>
            </div>
          )}

          {pageState === 'already_submitted' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>✓</div>
              <div className="pub-state-title">Avaliação já submetida</div>
              <div className="pub-state-msg">Esta avaliação já foi preenchida anteriormente. Obrigado!</div>
            </div>
          )}

          {pageState === 'success' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>✓</div>
              <div className="pub-state-title">Avaliação submetida!</div>
              <div className="pub-state-msg">Obrigado. A sua avaliação foi registada com sucesso.</div>
            </div>
          )}

          {pageState === 'form' && evaluation && (
            <>
              {/* Info card */}
              <div className="pub-card">
                <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.3px', marginBottom: 8 }}>
                  {evaluatee?.full_name ?? '—'}
                </h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: cycle?.end_date ? 14 : 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 10px', borderRadius: 20,
                    fontSize: 11, fontWeight: 600,
                    background: 'rgba(91,111,160,0.12)', color: '#7c8fc0',
                  }}>
                    {EVALUATION_TYPE_LABELS[evaluation.type] ?? evaluation.type}
                  </span>
                  {cycle?.name && (
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{cycle.name}</span>
                  )}
                </div>
                {cycle?.end_date && (
                  <div style={{
                    padding: '9px 13px',
                    background: 'rgba(224,203,75,0.07)',
                    border: '1px solid rgba(224,203,75,0.18)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--color-accent)',
                  }}>
                    Prazo: <strong>{formatDate(cycle.end_date)}</strong>
                  </div>
                )}
              </div>

              {/* Criteria form */}
              <form onSubmit={handleSubmit}>
                <div className="pub-card">
                  {/* Progress */}
                  <div className="pub-progress-label">
                    <span className="pub-section-label" style={{ marginBottom: 0 }}>Critérios de avaliação</span>
                    <span className="pub-progress-count">
                      {scoreValues.length}/{criteria.length}
                    </span>
                  </div>
                  <div className="pub-progress">
                    <div className="pub-progress-fill" style={{ width: `${progress * 100}%` }} />
                  </div>

                  {criteria.map(c => (
                    <div key={c.id} className="pub-cr-row">
                      <div className="pub-cr-label">{c.label}</div>
                      <div className="pub-cr-scores">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            className={`pub-cr-btn${scores[c.id] === n ? ' selected' : ''}`}
                            onClick={() => setScores(s => ({ ...s, [c.id]: n }))}
                            title={SCORE_LABELS[n]}
                          >
                            <span className="pub-cr-num">{n}</span>
                            <span className="pub-cr-lbl">{SCORE_LABELS[n]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="pub-card">
                  <div className="pub-section-label" style={{ marginBottom: 10 }}>Notas (opcional)</div>
                  <textarea
                    className="pub-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações adicionais…"
                    rows={3}
                    autoComplete="off"
                  />
                </div>

                {/* Average */}
                {avg !== null && (
                  <div className="pub-avg-row">
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Média parcial
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>{avg}</span>
                      <span style={{ fontSize: 13, color: avgColor(avg), fontWeight: 600 }}>
                        {SCORE_LABELS[Math.round(Number(avg))] ?? ''}
                      </span>
                    </div>
                  </div>
                )}

                {submitError && <p className="pub-error">{submitError}</p>}

                <div className="pub-submit-row">
                  <button
                    type="submit"
                    className="pub-submit-btn"
                    disabled={saving || scoreValues.length < criteria.length}
                  >
                    {saving ? 'A submeter…' : 'Submeter Avaliação'}
                  </button>
                  {scoreValues.length < criteria.length && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      Faltam {criteria.length - scoreValues.length} critério{criteria.length - scoreValues.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </>
  )
}
