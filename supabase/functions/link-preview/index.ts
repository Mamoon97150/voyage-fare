// "Paste a link → option" (build 9, mockup maps-v6, 16 Nov 2026). Opens the page the way a link
// preview does and reads what the site publishes for previews: name, picture, place, sometimes the
// price. No AI, no cost. Signed-in people only; never sent to a private address; small and quick
// (7 s, 1.5 MB, 4 redirects at most). Sites that refuse robots just give nothing back.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isPrivateAddress, mapsSpot, readPage } from './read.ts'

const ALLOWED = ['https://voyagefare.app', 'https://www.voyagefare.app', 'https://voyage-fare.vercel.app', 'http://localhost:5173']
const MAX_BYTES = 1_500_000

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

class Refused extends Error {}

async function safeHost(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Refused('Only web links (https://…).')
  if (url.port && !['80', '443'].includes(url.port)) throw new Refused('That link can’t be read.')
  const host = url.hostname
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || isPrivateAddress(host))
    throw new Refused('That link can’t be read.')
  const found: string[] = []
  for (const type of ['A', 'AAAA'] as const) {
    try {
      found.push(...(await Deno.resolveDns(host, type)))
    } catch {
      // No such record: fine, the other one may exist.
    }
  }
  if (!found.length) throw new Refused('That site can’t be found.')
  if (found.some(isPrivateAddress)) throw new Refused('That link can’t be read.')
}

async function readText(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => {})
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c.subarray(0, Math.min(c.length, size - at)), at)
    at += c.length
  }
  return new TextDecoder().decode(all)
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: who } = await supabase.auth.getUser()
  if (!who?.user) return new Response(JSON.stringify({ error: 'Sign in first.' }), { status: 401, headers })

  const input = await req.json().catch(() => ({}))
  let url: URL
  try {
    url = new URL(String(input.url ?? '').trim())
  } catch {
    return new Response(JSON.stringify({ error: 'Paste the whole address, starting with https://' }), { status: 400, headers })
  }

  try {
    let res: Response | null = null
    for (let hop = 0; hop <= 4; hop++) {
      // Google's cookie page (servers in Europe) carries the real address: go straight to it.
      const behind = url.hostname === 'consent.google.com' ? url.searchParams.get('continue') : null
      if (behind) url = new URL(behind)
      await safeHost(url)
      // A Google Maps address already says where: no need to open it.
      if (mapsSpot(url.toString())) return new Response(JSON.stringify(readPage('', url.toString())), { headers })
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(7000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VoyageFareLinkPreview/1.0)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en',
        },
      })
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('Location') : null
      if (!next) break
      await res.body?.cancel()
      url = new URL(next, url)
      res = null
    }
    if (!res) throw new Refused('That link goes round in circles.')
    if (!res.ok) {
      await res.body?.cancel()
      return new Response(JSON.stringify({ ...readPage('', url.toString()), refused: true }), { headers })
    }
    if (!(res.headers.get('Content-Type') ?? '').includes('html')) {
      await res.body?.cancel()
      return new Response(JSON.stringify(readPage('', url.toString())), { headers })
    }
    return new Response(JSON.stringify(readPage(await readText(res), url.toString())), { headers })
  } catch (e) {
    if (e instanceof Refused) return new Response(JSON.stringify({ error: e.message }), { status: 400, headers })
    // Too slow, refused, gone: say so, the person types it.
    return new Response(JSON.stringify({ ...readPage('', url.toString()), refused: true }), { headers })
  }
})
