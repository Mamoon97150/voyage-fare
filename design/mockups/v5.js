// Mockups in the v5 look (14 Nov): fine coloured pencil for lines, crayon for underlines and the budget bar.
// Same settings as the app (Sketch.tsx WEIGHTS, HandBar, index.html filters).
import rough from 'roughjs'

const colour = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

document.body.insertAdjacentHTML(
  'afterbegin',
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="vf-pencil" x="-5%" y="-20%" width="110%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.35" result="grain" />
      <feComposite in="SourceGraphic" in2="grain" operator="in" result="grained" />
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" seed="9" result="wobble" />
      <feDisplacementMap in="grained" in2="wobble" scale="1.4" />
    </filter>
    <filter id="vf-crayon" x="-5%" y="-40%" width="110%" height="180%">
      <feTurbulence type="fractalNoise" baseFrequency="0.32 0.9" numOctaves="3" seed="7" result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.9 1.62" result="grain" />
      <feComposite in="SourceGraphic" in2="grain" operator="in" result="grained" />
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="rag" />
      <feDisplacementMap in="grained" in2="rag" scale="2.4" />
    </filter></defs></svg>`,
)

await document.fonts.ready
await new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r)))

const WEIGHTS = {
  strong: { roughness: 1.8, bowing: 0.9, strokeWidth: 1.35, maxRandomnessOffset: 2.2 },
  light: { roughness: 1.7, bowing: 0.8, strokeWidth: 1, maxRandomnessOffset: 2 },
}

// Sheets: the app's SketchBox outline, in fine pencil.
for (const el of document.querySelectorAll('.sketch-box')) {
  const svg = el.querySelector('.sketch-box__line')
  const { width, height } = el.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('filter', 'url(#vf-pencil)')
  const w = el.classList.contains('sketch-box--strong') ? WEIGHTS.strong : WEIGHTS.light
  const dashed = Boolean(el.dataset.dashed)
  svg.appendChild(
    rough.svg(svg).rectangle(2, 2, width - 4, height - 4, {
      seed: Number(el.dataset.seed) || 7,
      ...w,
      stroke: 'currentColor',
      strokeLineDash: dashed ? [7, 6] : undefined,
      disableMultiStroke: dashed,
    }),
  )
}

// Budget bars coloured in with crayon; the outline in pencil.
for (const bar of document.querySelectorAll('.hand-bar[data-confirmed]')) {
  const svg = bar.querySelector('svg')
  const { width, height } = bar.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const r = rough.svg(svg)
  const c = Number(bar.dataset.confirmed)
  const e = Number(bar.dataset.estimated)
  const w = width - 4
  const bare = bar.classList.contains('hand-bar--mini')
  const hatch = { roughness: 1.2, fillStyle: 'hachure', hachureGap: bare ? 3 : 4, fillWeight: bare ? 2 : 3.2, hachureAngle: -25, stroke: 'none' }
  const fills = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  fills.setAttribute('filter', 'url(#vf-crayon)')
  if (c > 0) fills.appendChild(r.rectangle(2, 2, w * c, height - 4, { ...hatch, seed: 3, fill: colour('--confirmed', '#2f6b4f') }))
  if (e > 0) fills.appendChild(r.rectangle(2 + w * c, 2, w * e, height - 4, { ...hatch, seed: 4, fill: colour('--estimated', '#e2a93b') }))
  svg.appendChild(fills)
  if (!bare) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    line.setAttribute('filter', 'url(#vf-pencil)')
    line.appendChild(r.rectangle(2, 1, w, height - 2, { seed: 5, roughness: 1.6, bowing: 0.8, strokeWidth: 1.05, stroke: colour('--ink-soft', '#55615a') }))
    svg.appendChild(line)
  }
}

// Underlines: a crayon swipe in two passes (the app's Underlined).
for (const u of document.querySelectorAll('.u')) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'u__line')
  svg.setAttribute('filter', 'url(#vf-crayon)')
  u.append(svg)
  const { width } = u.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${width} 10`)
  const r = rough.svg(svg)
  svg.appendChild(r.curve([[0, 6], [width * 0.4, 4], [width * 0.8, 5], [width, 3]], { seed: width | 0, roughness: 1, strokeWidth: 5, stroke: 'currentColor' }))
  const second = r.curve([[2, 7], [width * 0.5, 5.5], [width - 4, 4.5]], { seed: (width | 0) + 1, roughness: 1.2, strokeWidth: 3, stroke: 'currentColor' })
  second.setAttribute('opacity', '0.8')
  svg.appendChild(second)
}
