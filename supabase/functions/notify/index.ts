// Phone notifications for admins (Admin stage C, mockup admin-v5, 15 Nov 2026).
// Called three ways:
//  · by the database on new feedback (header x-hook-token, a secret only the database knows);
//  · by Resend when hello@ receives an email (it only triggers a check: we ask Resend for unread
//    conversations we haven't announced yet, so a fake call can't invent a notification);
//  · by an admin's app: "key" (the public key to subscribe a phone) and "test".
// The notification keys are made here the first time and kept in private.push_settings.
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.5'
import webpush from 'npm:web-push@3.6.7'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 })
const ALLOWED = ['https://voyagefare.app', 'https://www.voyagefare.app', 'https://voyage-fare.vercel.app', 'http://localhost:5173']
const INBOX = 'hello@voyagefare.app'

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

type Settings = { vapid_public: string; vapid_private: string; hook_token: string; seen_threads: string[] }

async function settings(): Promise<Settings> {
  const [row] = await sql<Settings[]>`select vapid_public, vapid_private, hook_token, seen_threads from private.push_settings where id = 1`
  if (row.vapid_public && row.vapid_private) return row
  const keys = webpush.generateVAPIDKeys()
  await sql`update private.push_settings set vapid_public = ${keys.publicKey}, vapid_private = ${keys.privateKey} where id = 1`
  return { ...row, vapid_public: keys.publicKey, vapid_private: keys.privateKey }
}

/** Send to every admin's phones (or one admin's); drop phones that are gone. */
async function send(message: { title: string; body: string; url: string; tag: string }, onlyUser?: string) {
  const s = await settings()
  webpush.setVapidDetails('mailto:hello@voyagefare.app', s.vapid_public, s.vapid_private)
  const phones = onlyUser
    ? await sql`select endpoint, p256dh, auth from public.push_subscriptions where user_id = ${onlyUser}`
    : await sql`select p.endpoint, p.p256dh, p.auth from public.push_subscriptions p
                join public.admins a on a.user_id = p.user_id`
  let sent = 0
  for (const p of phones) {
    try {
      await webpush.sendNotification(
        { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
        JSON.stringify(message),
        { TTL: 3600 },
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await sql`delete from public.push_subscriptions where endpoint = ${p.endpoint}`
    }
  }
  return sent
}

const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const nameOf = (from: string) => from.replace(/<.*>/, '').replace(/"/g, '').trim() || from

async function newFeedback(id: string) {
  const [f] = await sql`select f.message, f.kind, u.raw_user_meta_data ->> 'first_name' as first_name
                        from public.feedback f left join auth.users u on u.id = f.user_id where f.id = ${id}`
  if (!f) return 0
  return send({
    title: '🔔 New feedback',
    body: `${f.first_name ?? 'Someone'}: “${short(f.message)}”`,
    url: '/admin?tab=messages',
    tag: `feedback-${id}`,
  })
}

/** hello@ got mail: announce unread conversations we haven't announced yet. */
async function newMail() {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return 0
  const res = await fetch(`https://api.resend.com/inboxes/${encodeURIComponent(INBOX)}/threads?read=false&limit=20`, {
    headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'voyage-fare-notify/1' },
  })
  if (!res.ok) return 0
  const { data = [] } = await res.json()
  const s = await settings()
  const fresh = (data as { id: string; from: string; subject: string | null }[]).filter((t) => !s.seen_threads.includes(t.id))
  let sent = 0
  for (const t of fresh) {
    sent += await send({
      title: '📮 New email to hello@',
      body: `${nameOf(t.from)}: “${short(t.subject ?? '(no subject)')}”`,
      url: '/admin?tab=messages',
      tag: `mail-${t.id}`,
    })
  }
  if (fresh.length) {
    const seen = [...fresh.map((t) => t.id), ...s.seen_threads].slice(0, 200)
    await sql`update private.push_settings set seen_threads = ${seen} where id = 1`
  }
  return sent
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers })
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

  try {
    const input = await req.json().catch(() => ({}))

    // 1. The database: new feedback.
    const token = req.headers.get('x-hook-token')
    if (token) {
      const s = await settings()
      if (token !== s.hook_token) return reply({ error: 'Not allowed' }, 403)
      if (input.type === 'feedback' && typeof input.id === 'string') return reply({ sent: await newFeedback(input.id) })
      return reply({ error: 'Unknown event' }, 400)
    }

    // 2. Resend: hello@ received an email (only a nudge to check).
    if (input.type === 'inbox.email.received' || input.type === 'email.received') return reply({ sent: await newMail() })

    // 3. An admin's app.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: isAdmin } = await supabase.rpc('am_i_admin')
    if (isAdmin !== true) return reply({ error: 'Admins only' }, 403)
    if (input.action === 'key') return reply({ key: (await settings()).vapid_public })
    if (input.action === 'test') {
      const { data: me } = await supabase.auth.getUser()
      const sent = await send(
        { title: 'Voyage Fare', body: 'Notifications are on for this phone ✓', url: '/admin', tag: 'test' },
        me.user?.id,
      )
      return reply({ sent })
    }
    return reply({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error(e)
    return reply({ error: 'Something went wrong.' }, 500)
  }
})
