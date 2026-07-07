import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EVAL_BASE_URL = 'https://gi-peopleflow.vercel.app/avaliar'

const TYPE_LABELS: Record<string, string> = {
  self:        'Autoavaliação',
  peer:        'Avaliação por Colega',
  manager:     'Avaliação por Chefia',
  general:     'Avaliação Geral',
  subordinate: 'Avaliação por Subordinado',
}

const TYPE_ORDER: Record<string, number> = { self: 0, peer: 1, manager: 2, general: 3, subordinate: 4 }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { evaluator_id, cycle_id } = await req.json()
    if (!evaluator_id || !cycle_id) return json({ error: 'evaluator_id e cycle_id são obrigatórios' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: evals, error: fetchErr } = await supabase
      .from('pf_evaluations')
      .select(`
        id, type, status, token,
        evaluatee:pf_employees!evaluatee_id(full_name),
        evaluator:pf_employees!evaluator_id(full_name, email),
        cycle:pf_evaluation_cycles!cycle_id(name, end_date)
      `)
      .eq('evaluator_id', evaluator_id)
      .eq('cycle_id', cycle_id)
      .in('status', ['pending', 'sent'])

    if (fetchErr) throw new Error(fetchErr.message)
    if (!evals?.length) return json({ error: 'Sem avaliações pendentes' }, 404)

    const evaluator = Array.isArray(evals[0].evaluator) ? evals[0].evaluator[0] : evals[0].evaluator
    const cycle     = Array.isArray(evals[0].cycle)     ? evals[0].cycle[0]     : evals[0].cycle

    if (!evaluator?.email) return json({ error: 'O avaliador não tem endereço de email' }, 422)

    const endDate = cycle?.end_date
      ? new Date(cycle.end_date + 'T00:00:00').toLocaleDateString('pt-PT', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : null

    const n  = evals.length
    const pl = n !== 1

    const sortedEvals = [...evals].sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99))

    const evalRowsHtml = sortedEvals.map(ev => {
      const evaluatee = Array.isArray(ev.evaluatee) ? ev.evaluatee[0] : ev.evaluatee
      const typeLabel = TYPE_LABELS[ev.type] ?? ev.type
      const link      = ev.token ? `${EVAL_BASE_URL}/${ev.token}` : null
      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #f0ede0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;margin-bottom:5px;">${typeLabel}</div>
            <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:12px;">${evaluatee?.full_name ?? '—'}</div>
            ${link
              ? `<a href="${link}" style="display:inline-block;background:#1a1a1a;color:#e0cb4b;font-size:13px;font-weight:700;padding:9px 20px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">Preencher questionário →</a>`
              : `<span style="font-size:12px;color:#e05252;">Link não disponível</span>`
            }
          </td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Avaliações de Desempenho</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:#1a1a1a;padding:28px 36px;">
            <div style="font-size:11px;font-weight:700;color:#e0cb4b;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px;">PeopleFlow · Gráfica Ideal</div>
            <div style="font-size:21px;font-weight:700;color:#fff;letter-spacing:-0.3px;">Avaliações de Desempenho</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 8px;">
            <p style="font-size:16px;color:#1a1a1a;margin:0 0 12px 0;">Olá <strong>${evaluator.full_name}</strong>,</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px 0;">
              Tens ${pl ? `${n} avaliações` : 'uma avaliação'} de desempenho pendente${pl ? 's' : ''} referente${pl ? 's' : ''} ao ciclo <strong>${cycle?.name ?? ''}</strong>.${endDate ? `<br>Por favor preenche cada questionário até <strong>${endDate}</strong>.` : ''}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${evalRowsHtml}
            </table>
            <p style="font-size:12px;color:#aaa;margin:24px 0 0;">Se tiveres alguma dúvida, contacta o departamento de Recursos Humanos.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafaf7;border-top:1px solid #eee;padding:18px 36px;">
            <p style="font-size:11px;color:#bbb;margin:0;">Este email foi enviado automaticamente pela plataforma PeopleFlow da Gráfica Ideal. Não respondas a este email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PeopleFlow <noreply@graficaideal.pt>',
        to: evaluator.email,
        subject: `Avaliações de Desempenho Pendentes — ${cycle?.name ?? ''}`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      throw new Error(`Resend: ${errBody}`)
    }

    // Only mark pending → sent (already-sent stay as is)
    const pendingIds = evals.filter(e => e.status === 'pending').map(e => e.id)
    if (pendingIds.length) {
      const { error: updateErr } = await supabase
        .from('pf_evaluations')
        .update({ status: 'sent' })
        .in('id', pendingIds)
      if (updateErr) console.error('Status update error:', updateErr.message)
    }

    return json({ success: true, sent: evals.length })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message ?? 'Erro interno' }, 500)
  }
})
