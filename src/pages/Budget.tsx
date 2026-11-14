import { Link } from 'react-router'
import { HandBar } from '../components/HandBar'
import { Card, MoneyScreen } from '../components/MoneyScreen'
import { formatWhole } from '../lib/money'
import { categoryLines, everyoneLines, notCounted, placeLines } from '../lib/moneyPages'

/**
 * Budget (build 4, mockup budget-v4): the notebook's last page. One card per section, like the
 * places on the trip page: by category, by place, everyone's share, and what isn't counted yet.
 */
export function Budget() {
  return (
    <MoneyScreen>
      {({ detail, money, viewer, mode, solo }) => {
        const currency = detail.trip.currency
        const cats = categoryLines(detail, money, viewer, mode)
        const scale = Math.max(1, ...cats.map((c) => c.amount ?? 0))
        const { lines: places, untied, packages } = placeLines(detail, viewer, mode)
        const figure = mode === 'mine' && viewer ? detail.travellerShares.find((s) => s.traveller_id === viewer)?.share_current : detail.budget?.current_total
        const whose = solo ? 'the trip' : mode === 'mine' ? 'your share' : 'whole trip'
        const missing = notCounted(detail)
        return (
          <>
            <Card title="By category" small={whose} total={formatWhole(figure === null || figure === undefined ? null : Number(figure), currency)} seed={71}>
              {cats.length === 0 ? (
                <p className="card__note">nothing priced yet</p>
              ) : (
                <ul className="lines">
                  {cats.map((c) => (
                    <li key={c.key} className="line">
                      <span>
                        <span className="line__name">{c.name}</span>
                        {c.meta && <span className="line__meta">{c.meta}</span>}
                        {!c.word && (c.amount ?? 0) > 0 && (
                          <span className="line__bar">
                            <HandBar confirmed={c.confirmed / scale} estimated={c.estimated / scale} target={null} over={false} bare />
                          </span>
                        )}
                      </span>
                      <b className="line__amount num">{c.word ?? formatWhole(c.amount, currency)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {places.length > 0 && (
              <Card title="By place" small={whose} seed={72}>
                <ul className="lines">
                  {places.map((p) => (
                    <li key={p.key} className="line">
                      <span>
                        <span className="line__name">{p.name}</span>
                        {p.meta && <span className="line__meta">{p.meta}</span>}
                      </span>
                      <b className="line__amount num">{formatWhole(p.amount ?? 0, currency)}</b>
                    </li>
                  ))}
                </ul>
                {packages > 0 && <p className="card__note">+ {formatWhole(packages, currency)} package, for the whole trip</p>}
                {untied > 0 && <p className="card__note">+ {formatWhole(untied, currency)} not tied to a place</p>}
              </Card>
            )}

            {!solo && (
              <Card title="Everyone’s share" small="the whole trip" total={formatWhole(detail.budget?.current_total === null || detail.budget?.current_total === undefined ? null : Number(detail.budget.current_total), currency)} seed={73}>
                <ul className="lines">
                  {everyoneLines(detail, viewer).map((t) => (
                    <li key={t.id} className="line line--who">
                      <span className={`avatar${t.id === viewer ? ' avatar--me' : ''}`} aria-hidden="true">
                        {t.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <span className="line__name">{t.name}</span>
                        {t.meta && <span className="line__meta">{t.meta}</span>}
                      </span>
                      <b className="line__amount num">{formatWhole(t.amount, currency)}</b>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {missing.length > 0 && (
              <Card title="Not counted yet" small={`${missing.length} without a price`} dashed seed={74}>
                <p className="card__note">{missing.join(' · ')}</p>
                <Link to={`/trips/${detail.trip.id}/compare`} className="quiet-link">
                  Price them in Compare ›
                </Link>
              </Card>
            )}
          </>
        )
      }}
    </MoneyScreen>
  )
}
