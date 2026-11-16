// The trip's email address (build 8 step 5b, mockup ai-reading-v5 screens 7–8, 16 Nov 2026).
// Resend calls this when an email reaches voyagefare.app. The call is only a nudge: we fetch the
// email from Resend ourselves (so a fake call can't invent one), and only keep it when
//  · it was sent to a trip's address (trips.mail_code), and
//  · it comes from the account address of one of that trip's travellers.
// The text is read by ai-read (same caps, counted for that traveller), and what it found goes to
// the trip's "To review". The email itself isn't kept.
import postgres from 'npm:postgres@3.4.5'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 })
const DOMAIN = '@voyagefare.app'
const MAX_CHARS = 60_000

const ok = (body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: true, ...body }), { headers: { 'Content-Type': 'application/json' } })

/** "Ana <ana@mail.com>" → "ana@mail.com" */
const addressOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase()

/** A plain-text body even when the email only has HTML. */
function textOf(email: { text?: string | null; html?: string | null }) {
  if (email.text) return email.text
  return (email.html ?? '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  try {
    const input = await req.json().catch(() => ({}))
    if (input.type !== 'email.received' || typeof input.data?.email_id !== 'string') return ok({ ignored: 'event' })
    const emailId: string = input.data.email_id

    const [seen] = await sql`select 1 from public.trip_mails where resend_id = ${emailId}`
    if (seen) return ok({ ignored: 'seen' })

    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return new Response('No Resend key', { status: 503 })
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'voyage-fare-trip-mail/1' },
    })
    if (res.status === 404) return ok({ ignored: 'unknown' })
    if (!res.ok) return new Response('Resend refused', { status: 502 }) // Resend tries again later
    const email = await res.json()

    // Which trip: one of the addresses it was sent to.
    const codes = [...(email.to ?? []), ...(email.cc ?? [])]
      .map((a: string) => addressOf(a))
      .filter((a: string) => a.endsWith(DOMAIN))
      .map((a: string) => a.slice(0, -DOMAIN.length))
    if (!codes.length) return ok({ ignored: 'address' })
    const [trip] = await sql`select id from public.trips where mail_code = any(${codes}) and not is_demo limit 1`
    if (!trip) return ok({ ignored: 'address' })

    // From one of its travellers' own address; anyone else is ignored (nothing kept).
    const sender = addressOf(String(email.from ?? ''))
    const [who] = await sql`
      select m.user_id, t.name as forwarder
      from public.trip_members m
      join auth.users u on u.id = m.user_id
      left join public.travellers t on t.trip_id = m.trip_id and t.user_id = m.user_id
      where m.trip_id = ${trip.id} and lower(u.email) = ${sender}
      limit 1`
    if (!who) return ok({ ignored: 'sender' })

    const subject = typeof email.subject === 'string' ? email.subject.slice(0, 200) : null
    const text = `Subject: ${subject ?? ''}\n\n${textOf(email)}`
    let found: Record<string, unknown> | null = null
    let problem: string | null = null
    if (text.length > MAX_CHARS) problem = 'too_long'
    else {
      const [s] = await sql`select hook_token from private.push_settings where id = 1`
      const read = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'x-hook-token': s.hook_token,
        },
        body: JSON.stringify({ kind: 'booking', text, user_id: who.user_id }),
      })
      const answer = await read.json().catch(() => ({}))
      if (read.ok && answer.result) {
        found = answer.result
        if (!answer.result.is_booking) problem = 'not_booking'
      } else problem = answer.code === 'paused' || answer.code === 'daily' || answer.code === 'off' ? 'paused' : 'unreadable'
    }

    await sql`
      insert into public.trip_mails (trip_id, resend_id, forwarded_by, forwarder, subject, found, problem)
      values (${trip.id}, ${emailId}, ${who.user_id}, ${who.forwarder}, ${subject},
              ${found ? sql.json(found) : null}, ${problem})
      on conflict (resend_id) do nothing`
    return ok({ saved: true })
  } catch (e) {
    console.error(e)
    return new Response('Something went wrong', { status: 500 })
  }
})
