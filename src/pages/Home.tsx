import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { HandBar } from '../components/HandBar'
import { Sketch, SketchBox, Underlined } from '../components/Sketch'
import { useAuth } from '../lib/authContext'

/** The demo trip (build 7, step 3): the main button once it's open. Until then, "Create my notebook". */
const DEMO_LINK: string | null = null
/** The case study (portfolio, January): the footer links to it once it's written. */
const STORY_LINK: string | null = null

/**
 * The welcome page, before signing in (mockup trips-welcome-v5, 15 Nov): the palm-tree sketch, what
 * it's for, a real trip as a sample (names hidden), how it works in three small pieces of the app,
 * four short facts, and who made it.
 */
export function Home() {
  const { session } = useAuth()
  return (
    <div className="page welcome-page">
      <header className="app-header">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span className="app-header__name">Voyage Fare</span>
        <span className="app-header__account">
          {session ? <Link to="/trips">Your trips</Link> : <Link to="/sign-in">Sign in</Link>}
        </span>
      </header>

      <main>
        <div className="welcome-top">
          <section className="welcome-hero">
            <Sketch name="welcome" width={320} />
            <h1>
              Plan the trip together, and know what it <Underlined>really costs you</Underlined>.
            </h1>
            <p className="welcome-hero__lede">
              A travel notebook for friends and family: compare the options, pick your coup de cœur, and everyone sees{' '}
              <b>their own share</b>, and who paid what.
            </p>
            <Actions signedIn={Boolean(session)} />
          </section>
          <SampleTrip />
        </div>

        <section className="welcome-how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <p className="hand welcome-how__note">three pages of the notebook</p>

          <Step n={1} title="Compare, then choose">
            Flights, hotels, tours: put the options side by side. Circle the one you pick, it goes in the budget.
            <SketchBox weight="light" className="welcome-mini" seed={91}>
              <div className="welcome-opt">
                <span className="welcome-opt__pick welcome-opt__pick--on" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <Underlined>Avianca</Underlined>
                  <small>via Bogotá · 13 h 25</small>
                </span>
                <span className="welcome-opt__amount num">
                  700 €<small className="welcome-opt__best">Cheapest</small>
                </span>
              </div>
              <div className="welcome-opt">
                <span className="welcome-opt__pick" aria-hidden="true" />
                <span>
                  Copa<small>via Panama · 11 h 10</small>
                </span>
                <span className="welcome-opt__amount num">
                  800 €<small>+100 €</small>
                </span>
              </div>
            </SketchBox>
          </Step>

          <Step n={2} title="Everyone sees their share">
            Rooms for two, a tour for three: each person sees what <i>they</i> pay, in euros, even when it was priced in
            pesos.
            <SketchBox weight="light" className="welcome-mini" seed={92}>
              <div className="welcome-people">
                {[
                  ['A', '2 846 €', 'you'],
                  ['B', '2 846 €', 'Bea'],
                  ['C', '2 512 €', 'Cleo'],
                  ['E', '1 980 €', 'Eva'],
                ].map(([initial, amount, name]) => (
                  <span key={name}>
                    <span className={`avatar${name === 'you' ? ' avatar--me' : ''}`} aria-hidden="true">
                      {initial}
                    </span>
                    <b className="num">{amount}</b>
                    {name}
                  </span>
                ))}
              </div>
            </SketchBox>
          </Step>

          <Step n={3} title="Who paid what, settled">
            Deposits, balances, the Uber on day 6: it works out who owes whom, in as few payments as possible.
            <SketchBox weight="light" className="welcome-mini" seed={93}>
              <p className="welcome-owe">
                <span className="avatar" aria-hidden="true">
                  C
                </span>
                Cleo pays you<b className="num">69 €</b>
              </p>
              <p className="welcome-owe">
                <span className="avatar" aria-hidden="true">
                  E
                </span>
                Eva pays Bea<b className="num">42 €</b>
              </p>
            </SketchBox>
          </Step>
        </section>

        <div className="welcome-facts">
          <p>
            <b>On your phone</b>Add it to your home screen, like an app.
          </p>
          <p>
            <b>Any currency</b>Pesos, dollars, euros: one budget.
          </p>
          <p>
            <b>Invite by link</b>They join as themselves, no setup.
          </p>
          <p>
            <b>Packages too</b>Agency deals and what’s left to pay.
          </p>
        </div>

        <div className="welcome-end">
          <Actions signedIn={Boolean(session)} end />
        </div>

        <footer className="welcome-foot">
          <span>Made by Djamina, for trips with her sisters.</span>
          {STORY_LINK && <a href={STORY_LINK}>The story behind it ›</a>}
        </footer>
      </main>
    </div>
  )
}

function Actions({ signedIn, end = false }: { signedIn: boolean; end?: boolean }) {
  if (signedIn)
    return (
      <p className="welcome-actions">
        <Link to="/trips" className="button button--primary">
          Open your trips
        </Link>
      </p>
    )
  if (end)
    return (
      <div className="welcome-actions">
        <Link to={DEMO_LINK ?? '/sign-up'} className="button button--primary">
          {DEMO_LINK ? 'Try it with a real trip' : 'Create my notebook'}
        </Link>
        <p className="welcome-actions__small">
          {DEMO_LINK ? (
            <>
              or <Link to="/sign-up">create your notebook</Link>, it’s free
            </>
          ) : (
            'It’s free.'
          )}
        </p>
      </div>
    )
  return (
    <div className="welcome-actions">
      {DEMO_LINK && (
        <Link to={DEMO_LINK} className="button button--primary">
          Try it with a real trip
        </Link>
      )}
      <Link to="/sign-up" className={`button ${DEMO_LINK ? 'button--quiet' : 'button--primary'}`}>
        Create my notebook
      </Link>
      <p className="hand welcome-actions__note">
        {DEMO_LINK ? 'no sign-up to look around' : 'free, and your trips stay private'}
      </p>
    </div>
  )
}

/** A real trip (Colombia & Panama, the names hidden), with the screen's one tape. */
function SampleTrip() {
  return (
    <SketchBox tape="mustard" className="welcome-sample" seed={81}>
      <p className="hand welcome-sample__label">a real trip, 4 travellers</p>
      <div className="big-trip__kicker">
        <span className="countdown countdown--now">14 nights · 5 places</span>
        <span className="avatars" aria-label="Ana (you), Bea, Cleo, Eva">
          {['A', 'B', 'C', 'E'].map((x) => (
            <span key={x} className={`avatar${x === 'A' ? ' avatar--me' : ''}`} aria-hidden="true">
              {x}
            </span>
          ))}
        </span>
      </div>
      <h2 className="big-trip__name">Colombia &amp; Panama</h2>
      <p className="route-words">
        {['Bogotá', 'Guatapé', 'Medellín', 'Cartagena', 'Panama'].map((p, i) => (
          <span key={p}>
            {i > 0 && <i aria-hidden="true">→</i>}
            {p}
          </span>
        ))}
      </p>
      <div className="card-share">
        <div className="card-share__row">
          <span className="card-share__figure num">2 846 €</span>
          <span className="card-share__words">your share</span>
        </div>
        <HandBar confirmed={0.82} estimated={0.18} target={null} over={false} />
        <div className="card-share__legend num">
          <span>
            <b className="card-share__confirmed">2 330 €</b> booked
          </span>
          <span>
            <b className="card-share__estimated">516 €</b> still estimated
          </span>
        </div>
      </div>
    </SketchBox>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="welcome-step">
      <span className="welcome-step__n" aria-hidden="true">
        {n}
      </span>
      <div>
        <h3>{title}</h3>
        <div className="welcome-step__text">{children}</div>
      </div>
    </div>
  )
}
