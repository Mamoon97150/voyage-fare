// Reading a page for "Paste a link → option" (build 9, mockup maps-v6): only what sites publish
// for link previews (Open Graph, JSON-LD). No AI. Nothing is made up: what isn't there stays null.
// Plain TypeScript (no Deno APIs) so the app's tests can check it.

export type Preview = {
  name: string | null
  image: string | null
  site: string | null
  price: number | null
  currency: string | null
  place: string | null
  latitude: number | null
  longitude: number | null
  url: string
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

/** <meta property|name="key" content="…"> in either order of attributes. */
function metas(html: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1]
    if (key && content !== undefined && !out.has(key)) out.set(key, decode(content))
  }
  return out
}

type Json = Record<string, unknown>

/** The JSON-LD things on the page, flattened (@graph, arrays). */
function jsonLd(html: string): Json[] {
  const out: Json[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      const o = v as Json
      if (Array.isArray(o['@graph'])) walk(o['@graph'])
      out.push(o)
    }
  }
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()))
    } catch {
      // A broken block is skipped, not guessed at.
    }
  }
  return out
}

const PLACES = /hotel|lodging|resort|hostel|restaurant|foodestablishment|bar|cafe|touristattraction|place|localbusiness|product|vacationrental|apartment|house|accommodation|event/i

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : NaN
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? decode(v) : null)
const firstImage = (v: unknown): string | null =>
  typeof v === 'string' ? v : Array.isArray(v) ? firstImage(v[0]) : v && typeof v === 'object' ? str((v as Json).url) : null

function absolute(href: string | null, base: string): string | null {
  if (!href) return null
  try {
    const u = new URL(href, base)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** "Quiet flat near Shibuya - Airbnb" → "Quiet flat near Shibuya" when the tail is the site. */
function withoutSite(title: string, site: string | null, host: string): string {
  const parts = title.split(/\s[|–—·-]\s/)
  if (parts.length < 2) return title
  const tail = parts[parts.length - 1].toLowerCase()
  const known = [site?.toLowerCase(), host.replace(/^www\./, '').split('.')[0]].filter(Boolean) as string[]
  return known.some((k) => tail.includes(k)) ? parts.slice(0, -1).join(' - ') : title
}

/** A Google Maps address after its redirects: the name and the spot it carries. */
export function mapsSpot(url: string): { name: string | null; latitude: number; longitude: number } | null {
  if (!/^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i.test(url)) return null
  const m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const name = url.match(/\/place\/([^/@]+)/)?.[1]
  return {
    name: name ? decodeURIComponent(name.replace(/\+/g, ' ')) : null,
    latitude: Number(m[1]),
    longitude: Number(m[2]),
  }
}

export function readPage(html: string, url: string): Preview {
  const host = new URL(url).hostname
  const meta = metas(html)
  const things = jsonLd(html)
  const thing = things.find((t) => PLACES.test(String(t['@type'] ?? ''))) ?? things[0] ?? {}
  const site = meta.get('og:site_name') ?? null

  const rawTitle =
    meta.get('og:title') ?? str(thing.name) ?? meta.get('twitter:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null)
  const name = rawTitle ? withoutSite(rawTitle, site, host).slice(0, 120) : null

  const image = /(^|\.)google\.[a-z.]+$/i.test(host) ? null : absolute(meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image') ?? firstImage(thing.image), url)

  const offers = (Array.isArray(thing.offers) ? thing.offers[0] : thing.offers) as Json | undefined
  let price = num(meta.get('product:price:amount') ?? meta.get('og:price:amount') ?? offers?.price ?? offers?.lowPrice)
  let currency = (meta.get('product:price:currency') ?? meta.get('og:price:currency') ?? str(offers?.priceCurrency) ?? null)?.toUpperCase() ?? null
  if (price === null || !currency || !/^[A-Z]{3}$/.test(currency)) {
    price = null
    currency = null
  }

  const geo = (thing.geo ?? {}) as Json
  let latitude = num(meta.get('place:location:latitude') ?? meta.get('og:latitude') ?? geo.latitude)
  let longitude = num(meta.get('place:location:longitude') ?? meta.get('og:longitude') ?? geo.longitude)
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    latitude = null
    longitude = null
  }
  const address = (thing.address ?? {}) as Json
  const place = str(address.addressLocality) ?? meta.get('og:locality') ?? null

  const spot = mapsSpot(url)
  // A Google Maps page: "Name · address" as its title, and its preview map's centre is the spot.
  // A page that isn't one place ("Google Maps", zoomed out on the visitor's country) says nothing.
  const google = /(^|\.)google\.[a-z.]+$/i.test(host) && url.includes('/maps') && rawTitle !== 'Google Maps'
  if (google && !spot && latitude === null) {
    const preview = meta.get('og:image') ?? ''
    const c = preview.match(/center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i)
    const zoom = Number(preview.match(/zoom=(\d+)/)?.[1] ?? 0)
    if (c && zoom >= 13) {
      latitude = Number(c[1])
      longitude = Number(c[2])
    }
  }
  const googleName = google && rawTitle ? rawTitle.split(' · ')[0].trim() : null
  const googlePlace = google && rawTitle && rawTitle.includes(' · ') ? rawTitle.split(' · ').slice(1).join(', ') : null
  return {
    name: spot?.name ?? googleName ?? (rawTitle === 'Google Maps' ? null : name),
    image,
    site: site ?? host.replace(/^www\./, ''),
    price,
    currency,
    place: place ?? googlePlace,
    latitude: spot?.latitude ?? latitude,
    longitude: spot?.longitude ?? longitude,
    url,
  }
}

/** Addresses a server must never be sent to read (this machine, the home network, the cloud's inside). */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (!ip.includes(':')) return false // a name, not an address: its addresses are checked instead
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (v6 === '::1' || v6 === '::') return true
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(v6)
}
