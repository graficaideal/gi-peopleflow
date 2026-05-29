import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, ClipboardList, RefreshCw, BarChart2,
  ChevronRight, CheckCircle2, Calendar,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { EvaluationTypeBadge } from '../components/evaluations/EvaluationBadge'
import { formatCycleType, formatDate } from '../utils/formatters'
import { SCORE_LABELS } from '../lib/constants'

// ── Helpers ──────────────────────────────────────────────────────────────────

function salutation(user) {
  const h = new Date().getHours()
  const period = h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite'
  const fullName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? ''
  const firstName = fullName.split(/\s+/)[0]
  return firstName ? `${period}, ${firstName} 👋` : `${period} 👋`
}

function today() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function calcDistribution(evals) {
  const byEvaluatee = {}
  evals.forEach(ev => {
    const scores = (ev.answers ?? []).map(a => a.score).filter(Boolean)
    if (!scores.length) return
    if (!byEvaluatee[ev.evaluatee_id]) byEvaluatee[ev.evaluatee_id] = []
    byEvaluatee[ev.evaluatee_id].push(...scores)
  })

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  Object.values(byEvaluatee).forEach(scores => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const bucket = Math.min(5, Math.max(1, Math.round(avg)))
    dist[bucket]++
  })

  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  return [5, 4, 3, 2, 1].map(score => ({
    score,
    label: SCORE_LABELS[score],
    count: dist[score],
    pct: total > 0 ? Math.round((dist[score] / total) * 100) : 0,
  }))
}

function barColor(score) {
  if (score <= 2) return '#e05252'
  if (score === 3) return '#ca8a04'
  return '#16a34a'
}

function normalize(val) {
  return Array.isArray(val) ? val[0] ?? null : val ?? null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeEmployees: 0,
    pendingCount: 0,
    activeCycle: null,
    closedCycle: null,
    pendingEvaluations: [],
  })

  useEffect(() => {
    const load = async () => {
      const [empRes, pendRes, activeCycleRes, closedCycleRes, pendEvRes] = await Promise.all([
        supabase.from('pf_employees')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('pf_evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('pf_evaluation_cycles')
          .select('*')
          .eq('status', 'active')
          .limit(1)
          .maybeSingle(),
        supabase.from('pf_evaluation_cycles')
          .select('id, name, type')
          .eq('status', 'closed')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('pf_evaluations')
          .select(`
            id, type,
            cycle:pf_evaluation_cycles(id, name),
            evaluatee:pf_employees!evaluatee_id(id, full_name, employee_number)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const activeC = activeCycleRes.data
      const closedC = closedCycleRes.data

      const phase2 = []
      if (activeC) {
        phase2.push(
          supabase.from('pf_evaluations').select('*', { count: 'exact', head: true }).eq('cycle_id', activeC.id),
          supabase.from('pf_evaluations').select('*', { count: 'exact', head: true }).eq('cycle_id', activeC.id).eq('status', 'submitted'),
        )
      }
      if (closedC) {
        phase2.push(
          supabase.from('pf_evaluations')
            .select('evaluatee_id, answers:pf_evaluation_answers(score)')
            .eq('cycle_id', closedC.id)
            .eq('status', 'submitted')
        )
      }

      let cycleProgress = { total: 0, submitted: 0 }
      let distribution = null

      if (phase2.length) {
        const p2 = await Promise.all(phase2)
        let i = 0
        if (activeC) {
          cycleProgress = { total: p2[i++].count ?? 0, submitted: p2[i++].count ?? 0 }
        }
        if (closedC) {
          distribution = calcDistribution(p2[i].data ?? [])
        }
      }

      setStats({
        activeEmployees: empRes.count ?? 0,
        pendingCount: pendRes.count ?? 0,
        activeCycle: activeC ? { ...activeC, ...cycleProgress } : null,
        closedCycle: closedC ? { ...closedC, distribution } : null,
        pendingEvaluations: pendEvRes.data ?? [],
      })
      setLoading(false)
    }

    load()
  }, [])

  const { activeEmployees, pendingCount, activeCycle, closedCycle, pendingEvaluations } = stats
  const cycleProgressPct = activeCycle?.total > 0
    ? Math.round((activeCycle.submitted / activeCycle.total) * 100)
    : 0

  return (
    <>
      <style>{`
        @keyframes db-fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes db-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* ── Stat cards ── */
        .db-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }
        @media (max-width: 900px) { .db-stats { grid-template-columns: repeat(2, 1fr); } }

        .db-stat {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          padding: 20px;
          animation: db-fadeUp 0.3s ease both;
        }
        .db-stat-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .db-stat-value {
          font-size: 30px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 5px;
        }
        .db-stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
        }
        .db-stat-sub {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: 6px;
          opacity: 0.8;
        }

        /* ── Panels row (cycle + distribution, equal height) ── */
        .db-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
          align-items: stretch;
        }
        @media (max-width: 800px) { .db-panels { grid-template-columns: 1fr; } }

        /* ── Section cards ── */
        .db-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          overflow: hidden;
          animation: db-fadeUp 0.3s ease both;
        }
        .db-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }
        .db-card-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.1px;
        }
        .db-card-count {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          background: rgba(234,179,8,0.1);
          color: #a16207;
        }
        .db-card-count.zero {
          background: var(--color-hover);
          color: var(--color-text-muted);
        }

        /* ── Pending eval rows ── */
        .db-eval-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          text-decoration: none;
          border-bottom: 1px solid var(--color-border);
          transition: background 0.15s;
        }
        .db-eval-row:last-child { border-bottom: none; }
        .db-eval-row:hover { background: var(--color-hover); }
        .db-eval-main { flex: 1; min-width: 0; }
        .db-eval-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .db-eval-meta {
          font-size: 11px;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .db-eval-arrow {
          color: var(--color-border);
          flex-shrink: 0;
          transition: color 0.15s, transform 0.15s;
        }
        .db-eval-row:hover .db-eval-arrow { color: var(--color-accent); transform: translateX(2px); }

        /* ── Active cycle card ── */
        .db-cycle-body { padding: 18px 20px; }
        .db-cycle-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.3px;
          margin-bottom: 4px;
        }
        .db-cycle-type {
          font-size: 12px;
          color: var(--color-text-muted);
          margin-bottom: 14px;
        }
        .db-progress-label {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--color-text-muted);
          margin-bottom: 6px;
        }
        .db-progress-track {
          height: 6px;
          background: var(--color-border);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .db-progress-fill {
          height: 100%;
          border-radius: 3px;
          background: var(--color-accent);
          transition: width 0.6s ease;
        }
        .db-cycle-dates {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--color-text-muted);
        }

        /* ── Distribution bars ── */
        .db-dist-body { padding: 16px 20px; }
        .db-dist-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 9px;
        }
        .db-dist-row:last-child { margin-bottom: 0; }
        .db-dist-label {
          width: 76px;
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-muted);
          flex-shrink: 0;
          text-align: right;
        }
        .db-dist-track {
          flex: 1;
          height: 8px;
          background: var(--color-border);
          border-radius: 4px;
          overflow: hidden;
        }
        .db-dist-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
          min-width: 2px;
        }
        .db-dist-count {
          width: 28px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-align: right;
          flex-shrink: 0;
        }

        /* ── Empty / skeleton ── */
        .db-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--color-text-muted);
          font-size: 13px;
        }
        .db-skel {
          height: 100%;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          overflow: hidden;
          position: relative;
        }
        .db-skel::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent);
          animation: db-shimmer 1.4s infinite;
        }
        [data-theme='dark'] .db-skel::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
        }

        .db-no-cycle {
          padding: 22px 20px;
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
        }
      `}</style>

      <div>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {salutation(user)}
          </h1>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>
            {today()}
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="db-stats" style={{ marginBottom: 28 }}>
            {[1, 2, 3, 4].map((i, idx) => (
              <div key={i} className="db-skel" style={{ height: 110, animationDelay: `${idx * 0.05}s` }} />
            ))}
          </div>
        ) : (
          <div className="db-stats">
            {/* Active employees */}
            <div className="db-stat" style={{ animationDelay: '0s' }}>
              <div className="db-stat-icon" style={{ background: 'rgba(45,100,200,0.08)', color: '#3b74d4' }}>
                <Users size={17} />
              </div>
              <div className="db-stat-value">{activeEmployees}</div>
              <div className="db-stat-label">Colaboradores ativos</div>
            </div>

            {/* Pending evaluations */}
            <div className="db-stat" style={{ animationDelay: '0.05s' }}>
              <div className="db-stat-icon" style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>
                <ClipboardList size={17} />
              </div>
              <div
                className="db-stat-value"
                style={{ color: pendingCount > 0 ? '#a16207' : 'var(--color-text)' }}
              >
                {pendingCount}
              </div>
              <div className="db-stat-label">Avaliações pendentes</div>
            </div>

            {/* Active cycle */}
            <div className="db-stat" style={{ animationDelay: '0.1s' }}>
              <div className="db-stat-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
                <RefreshCw size={17} />
              </div>
              {activeCycle ? (
                <>
                  <div
                    className="db-stat-value"
                    style={{ fontSize: 16, letterSpacing: '-0.3px', marginBottom: 3, color: '#16a34a' }}
                  >
                    Ativo
                  </div>
                  <div className="db-stat-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeCycle.name}
                  </div>
                  <div className="db-stat-sub">
                    {activeCycle.submitted}/{activeCycle.total} submetidas
                  </div>
                </>
              ) : (
                <>
                  <div className="db-stat-value" style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>—</div>
                  <div className="db-stat-label">Sem ciclo ativo</div>
                </>
              )}
            </div>

            {/* Last closed cycle */}
            <div className="db-stat" style={{ animationDelay: '0.15s' }}>
              <div className="db-stat-icon" style={{ background: 'rgba(100,60,200,0.08)', color: '#7c50d4' }}>
                <BarChart2 size={17} />
              </div>
              {closedCycle ? (
                <>
                  <div
                    className="db-stat-value"
                    style={{ fontSize: 15, letterSpacing: '-0.3px', marginBottom: 3 }}
                  >
                    {formatCycleType(closedCycle.type)}
                  </div>
                  <div className="db-stat-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {closedCycle.name}
                  </div>
                  <div className="db-stat-sub">Último ciclo fechado</div>
                </>
              ) : (
                <>
                  <div className="db-stat-value" style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>—</div>
                  <div className="db-stat-label">Sem ciclos fechados</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Panels: Ciclo Ativo + Distribuição — same height */}
        <div className="db-panels">

          {/* Ciclo Ativo */}
          {loading ? (
            <div className="db-skel" style={{ height: 180 }} />
          ) : (
            <div className="db-card" style={{ animationDelay: '0.1s' }}>
              <div className="db-card-header">
                <span className="db-card-title">Ciclo Ativo</span>
                {activeCycle && (
                  <Link
                    to="/cycles"
                    style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Ver →
                  </Link>
                )}
              </div>
              {activeCycle ? (
                <div className="db-cycle-body">
                  <div className="db-cycle-name">{activeCycle.name}</div>
                  <div className="db-cycle-type">{formatCycleType(activeCycle.type)}</div>
                  <div className="db-progress-label">
                    <span>Progresso</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {activeCycle.submitted}/{activeCycle.total}
                      <span style={{ fontWeight: 400 }}> ({cycleProgressPct}%)</span>
                    </span>
                  </div>
                  <div className="db-progress-track">
                    <div className="db-progress-fill" style={{ width: `${cycleProgressPct}%` }} />
                  </div>
                  {(activeCycle.start_date || activeCycle.end_date) && (
                    <div className="db-cycle-dates">
                      <Calendar size={12} />
                      <span>{formatDate(activeCycle.start_date)} – {formatDate(activeCycle.end_date)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="db-no-cycle">
                  Nenhum ciclo ativo.{' '}
                  <Link to="/cycles" style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>
                    Criar ciclo →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Distribuição de Resultados */}
          {loading ? (
            <div className="db-skel" style={{ height: 180 }} />
          ) : closedCycle?.distribution ? (
            <div className="db-card" style={{ animationDelay: '0.15s' }}>
              <div className="db-card-header">
                <span className="db-card-title">Distribuição — {closedCycle.name}</span>
              </div>
              <div className="db-dist-body">
                {closedCycle.distribution.map(({ score, label, count, pct }) => (
                  <div key={score} className="db-dist-row">
                    <div className="db-dist-label">{label}</div>
                    <div className="db-dist-track">
                      <div
                        className="db-dist-fill"
                        style={{ width: `${pct}%`, background: barColor(score), opacity: count === 0 ? 0.15 : 1 }}
                      />
                    </div>
                    <div className="db-dist-count" style={{ color: count > 0 ? barColor(score) : 'var(--color-border)' }}>
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="db-card" style={{ animationDelay: '0.15s' }}>
              <div className="db-card-header">
                <span className="db-card-title">Distribuição de Resultados</span>
              </div>
              <div className="db-no-cycle">Sem ciclos fechados com dados.</div>
            </div>
          )}
        </div>

        {/* Pending evaluations — full width */}
        {loading ? (
          <div className="db-skel" style={{ height: 320 }} />
        ) : (
          <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">Avaliações Pendentes</span>
                <span className={`db-card-count${pendingCount === 0 ? ' zero' : ''}`}>
                  {pendingCount}
                </span>
              </div>

              {pendingEvaluations.length === 0 ? (
                <div className="db-empty">
                  <CheckCircle2 size={28} style={{ marginBottom: 10, color: '#16a34a', opacity: 0.7 }} />
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                    Tudo em dia
                  </div>
                  <div>Não existem avaliações pendentes.</div>
                </div>
              ) : (
                <>
                  {pendingEvaluations.map(ev => {
                    const evaluatee = normalize(ev.evaluatee)
                    const cycle = normalize(ev.cycle)
                    return (
                      <Link key={ev.id} to={`/evaluations/${ev.id}`} className="db-eval-row">
                        <div className="db-eval-main">
                          <div className="db-eval-name">
                            {evaluatee?.full_name ?? '—'}
                            {evaluatee?.employee_number && (
                              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6, fontSize: 11 }}>
                                #{evaluatee.employee_number}
                              </span>
                            )}
                          </div>
                          <div className="db-eval-meta">
                            {cycle?.name ?? '—'}
                          </div>
                        </div>
                        <EvaluationTypeBadge type={ev.type} />
                        <ChevronRight size={14} className="db-eval-arrow" />
                      </Link>
                    )
                  })}
                  {pendingCount > pendingEvaluations.length && (
                    <Link
                      to="/evaluations"
                      style={{
                        display: 'block', padding: '11px 20px',
                        fontSize: 12, fontWeight: 600, color: 'var(--color-accent)',
                        textAlign: 'center', borderTop: '1px solid var(--color-border)',
                        textDecoration: 'none', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      Ver todas as {pendingCount} pendentes →
                    </Link>
                  )}
                </>
              )}
            </div>
          )}

      </div>
    </>
  )
}
