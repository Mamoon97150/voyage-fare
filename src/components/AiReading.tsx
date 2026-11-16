import { AiError } from '../lib/aiError'
import { FormMessage } from './AuthForm'

/*
 * Bits shared by the AI reading screens (build 8 step 5a, mockup ai-reading-v5): where the text goes,
 * the pencil while it reads, and the limits said plainly.
 */

export function WhereItGoes({ short = false }: { short?: boolean }) {
  return short ? (
    <p className="ai-who">
      Sent to <b>Claude</b> (Anthropic) to be read. We don’t keep it.
    </p>
  ) : (
    <p className="ai-who">
      Your text is sent to <b>Claude</b> (Anthropic) to be read. We don’t keep it, and it isn’t used to train their AI.
    </p>
  )
}

export function Reading() {
  return (
    <div className="ai-reading" role="status">
      <span className="ai-reading__pencil" aria-hidden="true">
        ✎
      </span>
      <span className="ai-reading__line" aria-hidden="true" />
      <p className="hand">reading your text…</p>
    </div>
  )
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/** Why it didn't read, in the app's words. */
export function AiProblem({ error }: { error: unknown }) {
  if (error instanceof AiError && error.code === 'paused')
    return (
      <FormMessage tone="info">
        <b>AI reading is paused this month.</b> It’s free, so it has a small monthly limit for everyone.
        {error.resumes ? ` It’s back on ${dayMonth.format(new Date(`${error.resumes}T00:00:00Z`))}.` : ''}
      </FormMessage>
    )
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return <FormMessage tone="error">{message}</FormMessage>
}
