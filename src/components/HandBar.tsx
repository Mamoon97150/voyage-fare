import { useLayoutEffect, useRef } from 'react'
import rough from 'roughjs'

/**
 * The budget bar, coloured in by hand (Compare v4, 13 Nov): pencil hatching in green for what's
 * confirmed and mustard for what's still estimated, a pencil outline, and a tick at the target.
 * Fractions are of the bar's width (0 to 1). Decorative: the figures next to it say the same.
 */
export function HandBar({
  confirmed,
  estimated,
  target,
  over,
  bare = false,
}: {
  confirmed: number
  estimated: number
  target: number | null
  over: boolean
  /** A small bar on a line (Budget's categories): just the hatching, no outline. */
  bare?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const line = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const el = box.current
    const svg = line.current
    if (!el || !svg) return
    const draw = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < 20 || height < 6) return
      const css = getComputedStyle(el)
      // The palette's variables (tokens.css): no colour typed here.
      const colour = (name: string) => css.getPropertyValue(name).trim() || 'currentColor'
      const r = rough.svg(svg)
      const w = width - 4
      const hatch = { roughness: 1.2, fillStyle: 'hachure', hachureGap: 3, fillWeight: 1.4, stroke: 'none' } as const
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      const parts: SVGGElement[] = []
      if (confirmed > 0) parts.push(r.rectangle(2, 3, w * confirmed, height - 6, { ...hatch, seed: 3, fill: colour('--confirmed') }))
      if (estimated > 0) {
        const fill = over ? colour('--over') : colour('--estimated')
        parts.push(r.rectangle(2 + w * confirmed, 3, w * estimated, height - 6, { ...hatch, seed: 4, fill }))
      }
      if (!bare) parts.push(r.rectangle(2, 2, w, height - 4, { seed: 5, roughness: 0.9, bowing: 1, strokeWidth: 1.1, stroke: colour('--ink-soft') }))
      if (target !== null) {
        const x = 2 + w * target
        parts.push(r.line(x, -2, x, height + 2, { seed: 6, roughness: 0.6, strokeWidth: 2, stroke: colour('--ink') }))
      }
      svg.replaceChildren(...parts)
    }
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(draw)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [confirmed, estimated, target, over, bare])

  return (
    <div ref={box} className={bare ? 'hand-bar hand-bar--mini' : 'hand-bar'} aria-hidden="true">
      <svg ref={line} />
    </div>
  )
}
