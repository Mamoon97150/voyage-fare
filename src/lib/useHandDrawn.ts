import { useLayoutEffect, useRef, type DependencyList } from 'react'
import rough from 'roughjs'

type RoughSvg = ReturnType<typeof rough.svg>

/**
 * A pen drawing at an element's real size, redrawn when it changes size (so it never stretches):
 * the sheets' outlines, the budget bar, Compare's folder tabs (code review, 14 Nov: three copies).
 * `draw` returns what to put in the <svg>; the same seed always gives the same line.
 *
 *   const { box, line } = useHandDrawn<HTMLDivElement>((pen, w, h) => [pen.rectangle(2, 2, w - 4, h - 4, …)], [seed])
 */
export function useHandDrawn<E extends HTMLElement>(
  draw: (pen: RoughSvg, width: number, height: number, el: E) => SVGElement[],
  deps: DependencyList,
  min: { width: number; height: number } = { width: 12, height: 12 },
) {
  const box = useRef<E>(null)
  const line = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const el = box.current
    const svg = line.current
    if (!el || !svg) return
    const redraw = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < min.width || height < min.height) return
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.replaceChildren(...draw(rough.svg(svg), width, height, el))
    }
    redraw()
    // Day ↔ night (dark mode): drawings that read the palette are drawn again in the new colours.
    window.addEventListener('vf-theme', redraw)
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('vf-theme', redraw)
    const watcher = new ResizeObserver(redraw)
    watcher.observe(el)
    return () => {
      watcher.disconnect()
      window.removeEventListener('vf-theme', redraw)
    }
    // The drawing depends on what the caller says (deps), not on the function's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { box, line }
}
