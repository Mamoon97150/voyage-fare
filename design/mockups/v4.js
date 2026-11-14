// Mockups in the v4 look (13 Nov): the app's pen, drawn at the real size of each element.
import rough from 'roughjs'

const colour = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

// Draw once the fonts are in: the outlines are drawn at each element's real size.
await document.fonts.ready
await new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r)))

// Sheets: the app's SketchBox outline (light pen).
for (const el of document.querySelectorAll('.sketch-box')) {
  const svg = el.querySelector('.sketch-box__line')
  const { width, height } = el.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.appendChild(rough.svg(svg).rectangle(2, 2, width - 4, height - 4, { seed: Number(el.dataset.seed) || 7, roughness: 1, bowing: 1, strokeWidth: el.classList.contains('sketch-box--strong') ? 1.4 : 1, stroke: 'currentColor', strokeLineDash: el.dataset.dashed ? [7, 6] : undefined, disableMultiStroke: Boolean(el.dataset.dashed) }))
}

// Bars coloured in with pencil: data-confirmed / data-estimated are fractions of the width.
for (const bar of document.querySelectorAll('.hand-bar[data-confirmed]')) {
  const svg = bar.querySelector('svg')
  const { width, height } = bar.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const r = rough.svg(svg)
  const c = Number(bar.dataset.confirmed)
  const e = Number(bar.dataset.estimated)
  const w = width - 4
  const hatch = { roughness: 1.2, fillStyle: 'hachure', hachureGap: height > 10 ? 3 : 2.5, fillWeight: 1.3, stroke: 'none' }
  if (c > 0) svg.appendChild(r.rectangle(2, 2, w * c, height - 4, { ...hatch, seed: 3, fill: colour('--confirmed', '#2f6b4f') }))
  if (e > 0) svg.appendChild(r.rectangle(2 + w * c, 2, w * e, height - 4, { ...hatch, seed: 4, fill: colour('--estimated', '#e2a93b') }))
  if (!bar.classList.contains('hand-bar--mini')) svg.appendChild(r.rectangle(2, 1, w, height - 2, { seed: 5, roughness: 0.9, bowing: 1, strokeWidth: 1.1, stroke: colour('--ink-soft', '#55615a') }))
}

// Hand underlines, uneven like a pen (the ones Djamina liked in mockup v4).
for (const u of document.querySelectorAll('.u')) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'u__line')
  u.append(svg)
  const { width } = u.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${width} 8`)
  svg.appendChild(rough.svg(svg).curve([[0, 5], [width * 0.4, 3], [width * 0.8, 4], [width, 2]], { seed: width | 0, roughness: 0.8, strokeWidth: 1.8, stroke: 'currentColor' }))
}
