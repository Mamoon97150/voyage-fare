// Is this password known from a data leak? (15 Nov: Supabase's own check is on the Pro plan only.)
// Have I Been Pwned's free "range" service, with k-anonymity: the password is hashed on the device
// and only the first 5 characters of its SHA-1 hash are sent; the service answers with every leaked
// hash starting with them, and the match is made here. The password itself never leaves the phone.
// If the service can't be reached, the password is accepted: nobody is blocked by it.

const RANGE = 'https://api.pwnedpasswords.com/range/'

async function sha1(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export async function isPwned(password: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const hash = await sha1(password)
    const res = await fetcher(RANGE + hash.slice(0, 5), {
      // Padding hides how many hashes start with the prefix (padded lines have a count of 0).
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const suffix = hash.slice(5)
    return (await res.text()).split('\n').some((line) => {
      const [rest, count] = line.trim().split(':')
      return rest === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}
