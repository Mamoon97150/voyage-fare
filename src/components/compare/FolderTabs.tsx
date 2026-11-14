import { useLayoutEffect, useRef } from 'react'
import rough from 'roughjs'
import { TABS, type Tab } from '../../lib/options'

/**
 * The notebook's folder tabs (Compare v4, 13 Nov), drawn with the same pen as the sheets and
 * sitting on the page: the open one is the sheet's paper, the others are behind it.
 * A mustard dot = something in it is still to decide.
 */
export function FolderTabs({ tab, todo, onTab }: { tab: Tab; todo: (t: Tab) => boolean; onTab: (t: Tab) => void }) {
  return (
    <div className="folder-tabs" role="tablist" aria-label="Categories">
      {TABS.map((t) => (
        <FolderTab key={t.key} on={t.key === tab} todo={todo(t.key)} label={t.label} onClick={() => onTab(t.key)} />
      ))}
    </div>
  )
}

function FolderTab({ on, todo, label, onClick }: { on: boolean; todo: boolean; label: string; onClick: () => void }) {
  const button = useRef<HTMLButtonElement>(null)
  const line = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const el = button.current
    const svg = line.current
    if (!el || !svg) return
    const draw = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < 12 || height < 12) return
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      // Open at the bottom: the open tab runs into its sheet.
      const foot = height + (on ? 2 : 0)
      svg.replaceChildren(
        rough.svg(svg).linearPath(
          [
            [2, foot],
            [5, 3],
            [width - 5, 3],
            [width - 2, foot],
          ],
          { seed: label.length * 7, roughness: 0.9, bowing: 0.6, strokeWidth: 1.1, stroke: 'currentColor' },
        ),
      )
    }
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(draw)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [on, label])

  return (
    <button
      ref={button}
      type="button"
      role="tab"
      aria-selected={on}
      className={`folder-tab${on ? ' folder-tab--on' : ''}${todo ? ' folder-tab--todo' : ''}`}
      onClick={onClick}
    >
      <svg ref={line} className="folder-tab__line" aria-hidden="true" />
      {label}
      {todo && <span className="visually-hidden"> (something to decide)</span>}
    </button>
  )
}
