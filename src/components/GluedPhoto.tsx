/** A photo glued into the notebook with drawn corners (mockup maps-v6). Pictures from links stay links. */
export function GluedPhoto({ src, label, className = '' }: { src: string; label?: string; className?: string }) {
  return (
    <span className={`glued-photo ${className}`}>
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <i aria-hidden="true" />
      {label && <span className="glued-photo__label">{label}</span>}
    </span>
  )
}
