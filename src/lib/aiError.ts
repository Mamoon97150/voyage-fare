/** Why AI reading didn't read: paused this month, the daily cap, too long… with words to show. */
export class AiError extends Error {
  code: string
  resumes: string | null
  constructor(code: string, message: string, resumes: string | null = null) {
    super(message)
    this.code = code
    this.resumes = resumes
  }
}
