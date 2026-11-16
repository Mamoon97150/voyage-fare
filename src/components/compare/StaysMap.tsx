import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type PricePin = { id: string; latitude: number; longitude: number; text: string; chosen: boolean }

/**
 * Stays on a map, in Compare (mockup maps-v6): each option's price where it is, on the same
 * paper-toned free map. Tapping a price brings its card up.
 */
export function StaysMap({
  pins,
  focused,
  onPick,
  label,
}: {
  pins: PricePin[]
  focused: string | null
  onPick: (id: string) => void
  label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  })

  // The map is drawn once per set of places; a hover only changes which price is inked in.
  const markers = useRef(new Map<string, HTMLElement>())
  const current = useRef(pins)
  useEffect(() => {
    current.current = pins
  })
  const key = pins.map((p) => `${p.id}:${p.latitude}:${p.longitude}:${p.text}:${p.chosen}`).join('|')
  useEffect(() => {
    const pins = current.current
    const el = box.current
    if (!el || pins.length === 0) return
    const map = L.map(el, { zoomControl: false, scrollWheelZoom: false, boxZoom: false, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 17,
    }).addTo(map)
    const found = new Map<string, HTMLElement>()
    for (const p of pins) {
      const cls = ['price-pin', p.chosen ? 'price-pin--chosen' : ''].filter(Boolean).join(' ')
      const marker = L.marker([p.latitude, p.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<button type="button" class="${cls}" aria-label="${p.text}">${p.text}</button>`,
          iconSize: [0, 0],
        }),
        keyboard: false,
      })
        .on('click', () => pick.current(p.id))
        .addTo(map)
      const node = marker.getElement()?.querySelector<HTMLElement>('.price-pin')
      if (node) found.set(p.id, node)
    }
    markers.current = found
    const pts = pins.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)
    if (pts.length === 1) map.setView(pts[0], 14)
    else map.fitBounds(L.latLngBounds(pts), { padding: [34, 34], maxZoom: 15 })
    return () => {
      map.remove()
      markers.current = new Map()
    }
  }, [key])

  useEffect(() => {
    for (const [id, node] of markers.current) node.classList.toggle('price-pin--on', id === focused)
  }, [focused, key])

  return <div ref={box} className="route-map stays-map" style={{ height: 220 }} role="img" aria-label={label} />
}
