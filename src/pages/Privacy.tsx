import { useEffect } from 'react'
import { SketchBox } from '../components/Sketch'
import { SiteBar, SiteFooter } from '../components/SiteNav'
import { CONTACT } from '../lib/site'

/**
 * Privacy, in plain words (mockup menus-v5, 15 Nov). Needed since we keep the emails of people in
 * Europe (GDPR). Change the date below whenever the content changes.
 */
export function Privacy() {
  // Opened from the footer, at the bottom of a long page: start at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div className="page welcome-page">
      <SiteBar />
      <main className="privacy">
        <h1>Privacy</h1>
        <p className="privacy__lede">In plain words. Last changed 15 November 2026.</p>
        <SketchBox weight="light" className="privacy__sheet" seed={35}>
          <h2>What we keep</h2>
          <ul>
            <li>Your email, your first name and your password (scrambled: nobody can read it, us included).</li>
            <li>Your trips: places, prices, who paid what, and the names you give your travellers.</li>
          </ul>
          <h2>Why</h2>
          <p>Only to run your notebook. No ads, nothing sold, no tracking.</p>
          <h2>Who helps us</h2>
          <ul>
            <li>Supabase keeps the data, on servers in Paris.</li>
            <li>Vercel serves the website.</li>
            <li>Resend sends our emails (confirm your email, a new password).</li>
            <li>Cloudflare runs the “not a robot” check when you sign in.</li>
          </ul>
          <h2>Your choices</h2>
          <ul>
            <li>Delete your account any time, in Account: your trips go with it.</li>
            <li>
              A question, or want a copy of your data? Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </li>
          </ul>
          <h2>Who’s behind it</h2>
          <p>Voyage Fare is made by Djamina, an independent maker in Saint-Martin.</p>
        </SketchBox>
      </main>
      <SiteFooter />
    </div>
  )
}
