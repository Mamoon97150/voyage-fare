/** Compass mark. Placeholder drawing until the canonical Canva logo is exported. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Voyage Fare">
      <circle cx="16" cy="16" r="14" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M16 5l3 11-3 11-3-11z" fill="var(--confirmed)" />
      <path d="M5 16l11-3 11 3-11 3z" fill="var(--estimated)" />
      <circle cx="16" cy="16" r="1.6" fill="var(--ink)" />
    </svg>
  )
}
