import { useHandDrawn } from '../../lib/useHandDrawn'
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
        <FolderTab
          key={t.key}
          cat={t.key}
          on={t.key === tab}
          todo={todo(t.key)}
          label={t.label}
          onClick={() => onTab(t.key)}
        />
      ))}
    </div>
  )
}

function FolderTab({
  cat,
  on,
  todo,
  label,
  onClick,
}: {
  cat: string
  on: boolean
  todo: boolean
  label: string
  onClick: () => void
}) {
  // Open at the bottom: the open tab runs into its sheet.
  const { box: button, line } = useHandDrawn<HTMLButtonElement>(
    (pen, width, height) => {
      const foot = height + (on ? 2 : 0)
      return [
        pen.linearPath(
          [
            [2, foot],
            [5, 3],
            [width - 5, 3],
            [width - 2, foot],
          ],
          {
            seed: label.length * 7,
            roughness: 1.6,
            bowing: 0.7,
            strokeWidth: 1.05,
            maxRandomnessOffset: 1.8,
            stroke: 'currentColor',
          },
        ),
      ]
    },
    [on, label],
  )

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
      <i className={`cat-dot cat-dot--${cat}`} aria-hidden="true" />
      {label}
      {todo && <span className="visually-hidden"> (something to decide)</span>}
    </button>
  )
}
