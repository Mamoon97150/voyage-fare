// Addresses the public pages and the account menu share (mockup menus-v5, 15 Nov).

export const DEMO_LINK = '/demo'
/** The case study (portfolio, January): linked once it's written, "soon" until then. */
export const STORY_LINK: string | null = null
export const CONTACT = 'hello@voyagefare.app'

/** "Send feedback": a short email to us, with the page the tester was on. */
export function feedbackLink(page: string) {
  const subject = encodeURIComponent('Voyage Fare: feedback')
  const body = encodeURIComponent(`\n\n—\nPage: ${page}`)
  return `mailto:${CONTACT}?subject=${subject}&body=${body}`
}
