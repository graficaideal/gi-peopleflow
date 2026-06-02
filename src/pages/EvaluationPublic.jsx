import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { SCORE_LABELS, EVALUATION_TYPE_LABELS } from '../lib/constants'
import { formatDate } from '../utils/formatters'

function avgColor(v) {
  if (!v) return '#6b7280'
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
      setPageState('expired')
      return
    }
    if (ev.status === 'submitted') { setPageState('already_submitted'); return }

    setEvaluation(ev)
    setCriteria(criteriaRes.data ?? [])

    const existingScores = Object.fromEntries(
      (ev.answers ?? []).map(a => [a.criteria_id, a.score])
    )
    setScores(existingScores)
    setNotes(ev.notes ?? '')

    if (ev.status === 'sent') {
      await supabase
        .from('pf_evaluations')
        .update({ status: 'opened' })
        .eq('id', ev.id)
    }

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
      evaluation_id: evaluation.id,
      criteria_id,
      score,
    }))

    const { error: answersErr } = await supabase
      .from('pf_evaluation_answers')
      .upsert(answers, { onConflict: 'evaluation_id,criteria_id' })

    if (answersErr) { setSubmitError(answersErr.message); setSaving(false); return }

    const { error: evalErr } = await supabase
      .from('pf_evaluations')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        notes: notes.trim() || null,
        token: null,
      })
      .eq('id', evaluation.id)

    if (evalErr) { setSubmitError(evalErr.message); setSaving(false); return }

    setPageState('success')
  }

  const cycle     = evaluation ? (Array.isArray(evaluation.cycle)     ? evaluation.cycle[0]     : evaluation.cycle)     : null
  const evaluatee = evaluation ? (Array.isArray(evaluation.evaluatee) ? evaluation.evaluatee[0] : evaluation.evaluatee) : null

  const scoreValues = criteria.map(c => scores[c.id]).filter(Boolean)
  const avg = scoreValues.length
    ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
    : null

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8f9fa; }

        .pub-page {
          min-height: 100vh;
          background: #f8f9fa;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #111827;
        }

        .pub-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 24px;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
        }
        .pub-header-logo {
          width: 28px;
          height: auto;
        }
        .pub-header-name {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
        }
        .pub-header-sub {
          font-size: 13px;
          color: #6b7280;
          margin-left: 2px;
        }

        .pub-main {
          max-width: 720px;
          margin: 32px auto;
          padding: 0 16px 64px;
        }

        .pub-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 28px;
          margin-bottom: 16px;
        }

        .pub-meta-tag {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }

        .pub-section-label {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 14px;
        }

        .pub-cr-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .pub-cr-row:last-child { border-bottom: none; }
        .pub-cr-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          flex: 1;
          min-width: 0;
        }
        .pub-cr-scores {
          display: flex;
          gap: 5px;
          flex-shrink: 0;
        }
        .pub-cr-btn {
          width: 54px;
          height: 48px;
          border-radius: 9px;
          border: 1.5px solid #e5e7eb;
          background: #f9fafb;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .pub-cr-btn:hover {
          border-color: #d4a017;
          background: rgba(212,160,23,0.05);
        }
        .pub-cr-btn.selected {
          background: #d4a017;
          border-color: #d4a017;
        }
        .pub-cr-num {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          line-height: 1;
        }
        .pub-cr-lbl {
          font-size: 8.5px;
          font-weight: 500;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.2px;
          text-align: center;
          line-height: 1.2;
        }
        .pub-cr-btn.selected .pub-cr-num,
        .pub-cr-btn.selected .pub-cr-lbl { color: #fff; }

        .pub-textarea {
          width: 100%;
          padding: 10px 13px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
          color: #111827;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          resize: vertical;
          line-height: 1.55;
          transition: border-color 0.15s;
        }
        .pub-textarea:focus { border-color: #d4a017; }
        .pub-textarea::placeholder { color: #9ca3af; }

        .pub-avg-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .pub-error {
          font-size: 12px;
          color: #e05252;
          background: rgba(220,60,60,0.06);
          border: 1px solid rgba(220,60,60,0.15);
          border-radius: 7px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }

        .pub-submit-btn {
          height: 42px;
          padding: 0 24px;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          border: none;
          background: #d4a017;
          color: #fff;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .pub-submit-btn:hover:not(:disabled) { opacity: 0.88; }
        .pub-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .pub-state-box {
          text-align: center;
          padding: 48px 24px;
        }
        .pub-state-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 26px;
        }
        .pub-state-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }
        .pub-state-msg {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.6;
        }

        @media (max-width: 560px) {
          .pub-cr-btn { width: 44px; height: 42px; }
          .pub-cr-num { font-size: 13px; }
          .pub-cr-lbl { display: none; }
          .pub-card { padding: 20px 16px; }
        }
      `}</style>

      <div className="pub-page">
        <header className="pub-header">
          <img src="/logo.svg" alt="GI" className="pub-header-logo" />
          <div>
            <span className="pub-header-name">PeopleFlow</span>
            <span className="pub-header-sub"> · GI</span>
          </div>
        </header>

        <main className="pub-main">
          {pageState === 'loading' && (
            <div className="pub-card pub-state-box">
              <div style={{ color: '#9ca3af', fontSize: 14 }}>A carregar…</div>
            </div>
          )}

          {pageState === 'invalid' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: '#fee2e2' }}>🔗</div>
              <div className="pub-state-title">Link inválido</div>
              <div className="pub-state-msg">Este link não existe ou foi removido.</div>
            </div>
          )}

          {pageState === 'expired' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: '#fef3c7' }}>⏱</div>
              <div className="pub-state-title">Link expirado</div>
              <div className="pub-state-msg">
                O prazo para preencher esta avaliação terminou.
                {cycle?.end_date && (
                  <> Prazo era {formatDate(cycle.end_date)}.</>
                )}
              </div>
            </div>
          )}

          {pageState === 'already_submitted' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: '#dcfce7' }}>✓</div>
              <div className="pub-state-title">Avaliação já submetida</div>
              <div className="pub-state-msg">Esta avaliação já foi preenchida anteriormente. Obrigado!</div>
            </div>
          )}

          {pageState === 'success' && (
            <div className="pub-card pub-state-box">
              <div className="pub-state-icon" style={{ background: '#dcfce7' }}>✓</div>
              <div className="pub-state-title">Avaliação submetida!</div>
              <div className="pub-state-msg">
                Obrigado. A sua avaliação foi registada com sucesso.
              </div>
            </div>
          )}

          {pageState === 'form' && evaluation && (
            <>
              {/* Evaluation header */}
              <div className="pub-card" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', marginBottom: 6 }}>
                    {evaluatee?.full_name ?? '—'}
                  </h1>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="pub-meta-tag" style={{ background: 'rgba(91,111,160,0.1)', color: '#5b6fa0' }}>
                      {EVALUATION_TYPE_LABELS[evaluation.type] ?? evaluation.type}
                    </span>
                    {cycle?.name && (
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{cycle.name}</span>
                    )}
                  </div>
                </div>
                {cycle?.end_date && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(212,160,23,0.07)',
                    border: '1px solid rgba(212,160,23,0.2)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#92400e',
                  }}>
                    Prazo para preenchimento: <strong>{formatDate(cycle.end_date)}</strong>
                  </div>
                )}
              </div>

              {/* Criteria form */}
              <form onSubmit={handleSubmit}>
                <div className="pub-card">
                  <div className="pub-section-label">Critérios de avaliação</div>
                  <div>
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
                </div>

                {/* Notes */}
                <div className="pub-card">
                  <div className="pub-section-label">Notas (opcional)</div>
                  <textarea
                    className="pub-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações adicionais…"
                    rows={4}
                  />
                </div>

                {/* Live average */}
                {avg !== null && (
                  <div className="pub-avg-row" style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      Média parcial ({scoreValues.length}/{criteria.length} critérios)
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button
                    type="submit"
                    className="pub-submit-btn"
                    disabled={saving || scoreValues.length < criteria.length}
                  >
                    {saving ? 'A submeter…' : 'Submeter Avaliação'}
                  </button>
                  {scoreValues.length < criteria.length && (
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      {scoreValues.length} de {criteria.length} critérios preenchidos
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
