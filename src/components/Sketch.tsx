import { useLayoutEffect, useRef, type ReactNode } from 'react'
import rough from 'roughjs'

/**
 * A sheet of the notebook, outlined by hand (look B, "illustrated carnet").
 * The outline is redrawn as a pen sketch at the card's real size, so it never stretches.
 * The same seed always gives the same line: it doesn't wobble from one render to the next.
 */
export function SketchBox({
  children,
  className = '',
  tape,
  seed = 7,
}: {
  children: ReactNode
  className?: string
  tape?: 'mustard' | 'green'
  seed?: number
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
          roughness: 1.3,
          bowing: 1.4,
          stroke: 'currentColor',
          strokeWidth: 1.4,
        }),
      )
    }
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(draw)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [seed])

  return (
    <div ref={box} className={`sketch-box ${className}`}>
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
