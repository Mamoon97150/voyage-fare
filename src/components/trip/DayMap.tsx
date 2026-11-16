import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DayMapView } from '../../lib/dayMap'

/**
 * A day on the map (mockup maps-v6): ⌂ where you sleep, then the day's places numbered in its
 * order, in their category's colour, joined by a dotted line. The same paper-toned free map as
 * the route. Drag and pinch to look closer.
 */
export function DayMap({ view, label }: { view: DayMapView; label: string }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el || view.stops.length === 0) return
    const map = L.map(el, {
      zoomControl: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 17,
    }).addTo(map)
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || 'currentColor'
    const pts: L.LatLngTuple[] = [
      ...(view.stay ? [[view.stay.latitude, view.stay.longitude] as L.LatLngTuple] : []),
      ...view.stops.map((s) => [s.at.latitude, s.at.longitude] as L.LatLngTuple),
    ]
    if (pts.length > 1)
      L.polyline(pts, { color: ink, weight: 2, dashArray: '2 6', opacity: 0.8, interactive: false }).addTo(map)
    if (view.stay)
      L.marker([view.stay.latitude, view.stay.longitude], {
        icon: pin('⌂', 'day-pin day-pin--stay'),
        interactive: false,
        keyboard: false,
        title: view.stay.name,
      }).addTo(map)
    for (const s of view.stops)
      L.marker([s.at.latitude, s.at.longitude], {
        icon: pin(String(s.n), `day-pin day-pin--${s.item.kind}`),
        interactive: false,
        keyboard: false,
        title: s.item.name,
      }).addTo(map)
    if (pts.length === 1) map.setView(pts[0], 15)
    else map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 16 })
    return () => {
      map.remove()
    }
  }, [view])

  return <div ref={box} className="route-map day-map" style={{ height: 170 }} role="img" aria-label={label} />
}

const pin = (text: string, className: string) =>
  L.divIcon({
    className: '',
    html: `<div class="${className}">${text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
