// The drawn buttons' shapes (look pass, 16 Nov): drawn once with rough.js — the same pen as the
// sheets — and kept as small SVGs that CSS uses as masks, so every button in the app is drawn
// without any work on the phone. Run: node scripts/sketch-shapes.mjs
import { writeFileSync } from 'node:fs'
import rough from 'roughjs/bundled/rough.esm.js'

const gen = rough.generator()
const pen = { roughness: 1.5, bowing: 0.7, strokeWidth: 1.05, maxRandomnessOffset: 1.6 }

function svg(w, h, drawables) {
  const paths = drawables
    .flatMap((d) => gen.toPaths(d))
    .map((p) =>
      p.fill && p.fill !== 'none'
        ? `<path d="${p.d}" fill="#000"/>`
        : `<path d="${p.d}" fill="none" stroke="#000" stroke-width="0.85" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${paths}</svg>\n`
}

// Three widths, so a long button isn't a short one stretched.
const sizes = { s: [84, 36], m: [170, 44], l: [340, 44] }
for (const [k, [w, h]] of Object.entries(sizes)) {
  writeFileSync(`public/sketch/box-${k}.svg`, svg(w, h, [gen.rectangle(3, 3, w - 6, h - 6, { ...pen, seed: w })]))
  writeFileSync(
    `public/sketch/fill-${k}.svg`,
    svg(w, h, [gen.rectangle(3, 3, w - 6, h - 6, { ...pen, seed: w + 1, fill: '#000', fillStyle: 'solid' })]),
  )
}
writeFileSync(
  'public/sketch/round.svg',
  svg(40, 40, [gen.ellipse(20, 20, 34, 34, { ...pen, seed: 5, roughness: 1.3 })]),
)
writeFileSync(
  'public/sketch/round-fill.svg',
  svg(40, 40, [gen.ellipse(20, 20, 34, 34, { ...pen, seed: 6, roughness: 1.3, fill: '#000', fillStyle: 'solid' })]),
)
// A sheet laid over the page on a computer (build 8½): tall, so its pencil isn't a button's stretched.
writeFileSync(
  'public/sketch/panel.svg',
  svg(420, 760, [gen.rectangle(4, 4, 412, 752, { ...pen, seed: 8, roughness: 1.8, bowing: 0.9 })]).replace(
    /stroke-width="0.85"/g,
    'stroke-width="1.3"',
  ),
)
console.log('sketch shapes written')
