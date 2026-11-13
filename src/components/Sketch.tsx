import { useLayoutEffect, useRef, type ReactNode } from 'react'
import rough from 'roughjs'

/**
 * A sheet of the notebook, outlined by hand (look B, "illustrated carnet").
 * The outline is redrawn as a pen sketch at the card's real size, so it never stretches.
 * The same seed always gives the same line: it doesn't wobble from one render to the next.
 *
 * One style, two weights (decided 13 Nov 2026):
 * - strong: moments (welcome, empty pages, forms), with tape;
 * - light: working sheets (places, trip cards) that stack in long lists.
 * dashed: for what isn't a place (the whole-trip sheet).
 */
const WEIGHTS = {
  strong: { roughness: 1.3, bowing: 1.4, strokeWidth: 1.4 },
  light: { roughness: 1, bowing: 1, strokeWidth: 1 },
} as const

export function SketchBox({
  children,
  className = '',
  tape,
  seed = 7,
  weight = 'strong',
  dashed = false,
}: {
  children: ReactNode
  className?: string
  tape?: 'mustard' | 'green'
  seed?: number
  weight?: keyof typeof WEIGHTS
  dashed?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const line = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const el = box.current
    const svg = line.current
    if (!el || !svg) return
    const draw = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < 12 || height < 12) return
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.replaceChildren(
        rough.svg(svg).rectangle(2, 2, width - 4, height - 4, {
          seed,
          ...WEIGHTS[weight],
          stroke: 'currentColor',
          strokeLineDash: dashed ? [7, 6] : undefined,
          disableMultiStroke: dashed, // a dashed double line looks like a mistake
        }),
      )
    }
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(draw)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [seed, weight, dashed])

  return (
    <div ref={box} className={`sketch-box sketch-box--${weight} ${className}`}>
      <svg ref={line} className="sketch-box__line" aria-hidden="true" />
      {tape && <span className={`tape tape--${tape}`} aria-hidden="true" />}
      {children}
    </div>
  )
}

/** A quick mustard marker stroke under a word. */
export function Underlined({ children }: { children: ReactNode }) {
  return (
    <span className="underlined">
      {children}
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 6c20-3 45-4 70-3 9 .4 18 1.3 26 2.4" />
      </svg>
    </span>
  )
}

export type Drawing = 'welcome' | 'no-trips' | 'empty-trip' | 'compare-empty' | 'settled'

/** One of the carnet sketches. Decorative: the text next to it says what the page is about. */
export function Sketch({ name, width }: { name: Drawing; width: number }) {
  return <img className="sketch" src={`/illustrations/sketch-${name}.webp`} width={width} alt="" />
}
