import { BudgetBar } from './components/BudgetBar'
import { Logo } from './components/Logo'

export default function App() {
  return (
    <div className="page">
      <header className="app-header">
        <Logo />
        <span className="app-header__name">Voyage Fare</span>
      </header>

      <main>
        <section className="hero">
          <h1>See your whole trip, and know exactly what it really costs.</h1>
          <p>
            A trip planner built around the budget: compare your options, follow your coup de
            cœur, and always know what it costs per person and who paid what.
          </p>
        </section>

        <BudgetBar label="Sample trip · per person" confirmed={1259} estimated={640} />

        <p className="note">In the making. Sample numbers, not a real trip.</p>
      </main>
    </div>
  )
}
