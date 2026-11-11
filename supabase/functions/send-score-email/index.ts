import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Sends an employee the global average of the evaluations they received in the
// most recent closed cycle, and logs the send in pf_score_notifications.

const SCORE_LABELS: Record<number, string> = { 1: 'Mau', 2: 'Medíocre', 3: 'Suficiente', 4: 'Bom', 5: 'Muito Bom' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const scoreColor = (v: number) => (v <= 2 ? '#e05252' : v <= 3 ? '#ca8a04' : '#16a34a')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only logged-in app users may trigger this (the anon key alone is not enough).
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: { user } } = await supabase.auth.getUser(jwt)
    if (!user) return json({ error: 'Não autenticado' }, 401)

    const { employee_id } = await req.json()
    if (!employee_id) return json({ error: 'employee_id é obrigatório' }, 400)

    const [{ data: employee, error: empErr }, { data: cycle, error: cycleErr }] = await Promise.all([
      supabase.from('pf_employees').select('id, full_name, email').eq('id', employee_id).maybeSingle(),
      supabase.from('pf_evaluation_cycles').select('id, name').eq('status', 'closed')
        .order('end_date', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (empErr) throw new Error(empErr.message)
    if (cycleErr) throw new Error(cycleErr.message)
    if (!employee) return json({ error: 'Colaborador não encontrado' }, 404)
    if (!employee.email) return json({ error: 'O colaborador não tem endereço de email' }, 422)
    if (!cycle) return json({ error: 'Não existe nenhum ciclo fechado' }, 404)

    const { data: evals, error: evalErr } = await supabase
      .from('pf_evaluations')
      .select('answers:pf_evaluation_answers(score)')
      .eq('evaluatee_id', employee_id)
      .eq('cycle_id', cycle.id)
      .eq('status', 'submitted')
    if (evalErr) throw new Error(evalErr.message)

    // Same formula as the reports' "Média Global": flat mean of every submitted score.
    const scores = (evals ?? []).flatMap(e => (e.answers ?? []).map((a: { score: number }) => a.score))
      .filter(n => typeof n === 'number')
    if (!scores.length) return json({ error: 'Sem avaliações submetidas no último ciclo fechado' }, 404)

    const avg     = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    const avgText = avg.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const label   = SCORE_LABELS[Math.round(avg)] ?? ''
    const color   = scoreColor(avg)

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Resultado da Avaliação</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:#1a1a1a;padding:28px 36px;">
            <div style="font-size:11px;font-weight:700;color:#e0cb4b;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px;">PeopleFlow · Gráfica Ideal</div>
            <div style="font-size:21px;font-weight:700;color:#fff;letter-spacing:-0.3px;">Resultado da Avaliação</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 8px;">
            <p style="font-size:16px;color:#1a1a1a;margin:0 0 12px 0;">Olá <strong>${employee.full_name}</strong>,</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px 0;">
              O ciclo de avaliação <strong>${cycle.name}</strong> já terminou. Obrigado pela tua participação.<br>
              A média global das avaliações que recebeste neste ciclo foi:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7;border:1px solid #f0ede0;border-radius:10px;">
              <tr><td align="center" style="padding:24px 16px;">
                <span style="font-size:44px;font-weight:800;color:${color};letter-spacing:-1px;">${avgText}</span>
                <span style="font-size:16px;font-weight:600;color:#999;"> / 5</span>
                <div style="font-size:14px;font-weight:700;color:${color};margin-top:4px;text-transform:uppercase;letter-spacing:0.6px;">${label}</div>
              </td></tr>
            </table>
            <p style="font-size:13px;color:#555;line-height:1.7;margin:20px 0 8px 0;">
              Este valor é a média de todas as respostas submetidas sobre ti neste ciclo (autoavaliação, chefia e colegas), em todos os critérios avaliados.
            </p>
            <p style="font-size:12px;color:#999;margin:0 0 20px 0;">Escala: 1 Mau · 2 Medíocre · 3 Suficiente · 4 Bom · 5 Muito Bom</p>
            <p style="font-size:12px;color:#aaa;margin:0 0 24px 0;">Se quiseres falar sobre o resultado, fala com a tua chefia direta ou com o departamento de Recursos Humanos.</p>
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
        to: employee.email,
        subject: `Resultado da tua Avaliação de Desempenho — ${cycle.name}`,
        html,
      }),
    })
    if (!resendRes.ok) throw new Error(`Resend: ${await resendRes.text()}`)

    const sent_at = new Date().toISOString()
    const { error: logErr } = await supabase
      .from('pf_score_notifications')
      .upsert({ employee_id, cycle_id: cycle.id, sent_at }, { onConflict: 'employee_id,cycle_id' })
    // Email already went out; report the log failure but don't fail the request.
    if (logErr) console.error('Log error:', logErr.message)

    return json({ success: true, cycle_id: cycle.id, sent_at })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message ?? 'Erro interno' }, 500)
  }
})
