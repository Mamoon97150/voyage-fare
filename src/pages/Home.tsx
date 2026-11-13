import { Link } from 'react-router'
import { BudgetBar } from '../components/BudgetBar'
import { Logo } from '../components/Logo'
import { useAuth } from '../lib/authContext'

export function Home() {
  const { session } = useAuth()
  return (
    <div className="page">
      <header className="app-header">
        <Logo />
        <span className="app-header__name">Voyage Fare</span>
        <span className="app-header__account">
          {session ? (
            <Link to="/trips">Your trips</Link>
          ) : (
            <Link to="/sign-in">Sign in</Link>
          )}
        </span>
      </header>

      <main>
        <section className="hero">
          <h1>See your whole trip, and know exactly what it really costs.</h1>
          <p>
            A trip planner built around the budget: compare your options, follow your coup de
            cœur, and always know what it costs per person and who paid what.
          </p>
          {!session && (
            <p className="hero__actions">
              <Link to="/sign-up" className="button button--primary">
                Create an account
              </Link>
            </p>
          )}
        </section>

        <BudgetBar label="Sample trip · per person" confirmed={1259} estimated={640} />

        <p className="note">In the making. Sample numbers, not a real trip.</p>
      </main>
    </div>
  )
}
