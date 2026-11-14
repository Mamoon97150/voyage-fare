import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { homeDirection, type LatLng, type Route } from '../lib/route'

/**
 * The route drawn on a free map (OpenStreetMap, toned to the paper): numbered pins in route order
 * joined by a pen line, framed on the places; home is a dotted line leaving the map with
 * "⌂ St Martin ↗" at the edge (mockup route-map-v4). Small = just to look at; big = zoom and drag.
 */
export function RouteMap({ route, big = false, height }: { route: Route; big?: boolean; height: number }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el || route.pinned.length === 0) return
    const map = L.map(el, {
      zoomControl: big,
      dragging: big,
      touchZoom: big,
      doubleClickZoom: big,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: big,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 16,
    }).addTo(map)

    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || 'currentColor'
    const pts: LatLng[] = route.pinned.map((s) => s.at)
    const home = route.home?.at ?? null

    if (home) {
      L.polyline([home, pts[0]], { color: ink, weight: 1.6, dashArray: '2 5', opacity: 0.7, interactive: false }).addTo(map)
      L.polyline([pts[pts.length - 1], home], { color: ink, weight: 1.6, dashArray: '2 5', opacity: 0.7, interactive: false }).addTo(map)
      L.marker(home, { icon: pin('⌂', 'route-pin route-pin--home'), interactive: false, keyboard: false }).addTo(map)
    }
    if (pts.length > 1) L.polyline(pts, { color: ink, weight: 2, dashArray: '7 5', opacity: 0.85, interactive: false }).addTo(map)

    // Framed on the places; one place alone gets a city-sized view.
    if (pts.length === 1) map.setView(pts[0], 9)
    else map.fitBounds(L.latLngBounds(pts), { padding: [28, 28], maxZoom: 11 })

    // Two places close together (Guatapé and Medellín) would hide each other's number:
    // push the later pin away from its neighbour until both stay readable.
    map.invalidateSize({ pan: false })
    const placed: L.Point[] = []
    for (const s of route.pinned) {
      const at = map.latLngToContainerPoint(s.at)
      const near = placed.find((p) => p.distanceTo(at) < 24)
      let offset = L.point(0, 0)
      if (near) {
        const d = at.subtract(near)
        const len = d.x === 0 && d.y === 0 ? 0 : Math.hypot(d.x, d.y)
        const unit = len === 0 ? L.point(1, 0) : L.point(d.x / len, d.y / len)
        offset = unit.multiplyBy(24 - len)
      }
      placed.push(at.add(offset))
      L.marker(s.at, { icon: pin(String(s.n), 'route-pin', offset), interactive: false, keyboard: false, title: s.place.name }).addTo(map)
      if (big) {
        L.marker(s.at, {
          icon: L.divIcon({ className: 'route-label', html: escape(s.place.name), iconSize: [0, 0], iconAnchor: [offset.x < 0 ? s.place.name.length * 7.5 + 14 - offset.x : -14 - offset.x, 9 - offset.y] }),
          interactive: false,
          keyboard: false,
        }).addTo(map)
      }
    }

    // Home off the map: an arrow at the edge it lies towards.
    if (home && route.home && !map.getBounds().contains(home)) {
      const { arrow, edge } = homeDirection(pts, home)
      const tag = document.createElement('div')
      tag.className = `route-home route-home--${edge}`
      tag.textContent = `⌂ ${route.home.name} ${arrow}`
      el.appendChild(tag)
    }

    return () => {
      map.remove()
      el.querySelectorAll('.route-home').forEach((n) => n.remove())
    }
  }, [route, big])

  return (
    <div
      ref={box}
      className={big ? 'route-map route-map--big' : 'route-map'}
      style={{ height }}
      role="img"
      aria-label={`Map of the route: ${route.pinned.map((s) => s.place.name).join(', ')}`}
    />
  )
}

const pin = (text: string, className: string, offset = L.point(0, 0)) =>
  L.divIcon({ className: '', html: `<div class="${className}">${escape(text)}</div>`, iconSize: [22, 22], iconAnchor: [11 - offset.x, 11 - offset.y] })

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
