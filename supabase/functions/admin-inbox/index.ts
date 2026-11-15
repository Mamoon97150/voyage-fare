// hello@voyagefare.app inside Admin (build 8, Admin stage B, mockup admin-v5, 15 Nov 2026).
// The Resend key lives here, on the server (secret RESEND_API_KEY), never in the app.
// Every call checks that the person asking is an admin (public.am_i_admin(), with their own login).
// Actions: list · read (one conversation, marked read) · reply (sent from hello@) · done / undone.
import { createClient } from 'npm:@supabase/supabase-js@2'

const INBOX = 'hello@voyagefare.app'
const RESEND = 'https://api.resend.com'
const ALLOWED = ['https://voyagefare.app', 'https://www.voyagefare.app', 'https://voyage-fare.vercel.app', 'http://localhost:5173']

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

async function resend(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Response(JSON.stringify({ error: 'The Resend key isn’t set up yet.' }), { status: 503 })
  const res = await fetch(`${RESEND}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'voyage-fare-admin/1',
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Response(JSON.stringify({ error: body?.message ?? 'Resend refused the request.' }), { status: 502 })
  return body
}

const inbox = `/inboxes/${encodeURIComponent(INBOX)}`

/** A plain-text body even when the email only has HTML. */
function textOf(email: { text?: string | null; html?: string | null }) {
  if (email.text) return email.text
  return (email.html ?? '')
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers })

  try {
    // Who's asking, with their own login: only admins get past this.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: isAdmin } = await supabase.rpc('am_i_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers })

    const input = await req.json().catch(() => ({}))
    const action = String(input.action ?? '')
    const thread = typeof input.threadId === 'string' ? encodeURIComponent(input.threadId) : null

    if (action === 'list') {
      const list = await resend(`${inbox}/threads?folders=inbox,archive&limit=50`)
      const threads = (list.data ?? []).map((t: Record<string, unknown>) => ({
        id: t.id,
        subject: t.subject,
        from: t.from,
        emails: t.email_count,
        read: t.read,
        done: t.folder === 'archive',
        received_at: t.received_at,
      }))
      return new Response(JSON.stringify({ threads }), { headers })
    }

    if (action === 'read' && thread) {
      const list = await resend(`${inbox}/threads/${thread}/emails?limit=50`)
      const emails = await Promise.all(
        (list.data ?? []).map(async (e: { id: string }) => {
          const full = await resend(`${inbox}/threads/${thread}/emails/${encodeURIComponent(e.id)}`)
          return {
            id: full.id,
            direction: full.direction,
            from: full.from,
            subject: full.subject,
            text: textOf(full),
            attachments: (full.attachments ?? []).map((a: { filename: string }) => a.filename),
            received_at: full.received_at,
          }
        }),
      )
      await resend(`${inbox}/threads/${thread}`, { method: 'PATCH', body: JSON.stringify({ read: true }) })
      return new Response(JSON.stringify({ emails }), { headers })
    }

    if (action === 'reply' && thread && typeof input.emailId === 'string') {
      const text = String(input.text ?? '').trim()
      if (!text) return new Response(JSON.stringify({ error: 'Write your reply first.' }), { status: 400, headers })
      const sent = await resend(`${inbox}/threads/${thread}/emails/${encodeURIComponent(input.emailId)}/reply`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `reply/${input.emailId}/${String(input.key ?? '')}`.slice(0, 256) },
        body: JSON.stringify({ text }),
      })
      return new Response(JSON.stringify({ id: sent.id }), { headers })
    }

    if ((action === 'done' || action === 'undone') && thread) {
      await resend(`${inbox}/threads/${thread}`, {
        method: 'PATCH',
        body: JSON.stringify({ folder: action === 'done' ? 'archive' : 'inbox', ...(action === 'done' ? { read: true } : {}) }),
      })
      return new Response(JSON.stringify({ ok: true }), { headers })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers })
  } catch (e) {
    if (e instanceof Response) {
      return new Response(await e.text(), { status: e.status, headers })
    }
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500, headers })
  }
})
