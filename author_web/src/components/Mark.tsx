import portrait from '@amakefe/core/brand/portrait.webp'

/**
 * The brand mark — the illustrated portrait from the logo sheet in
 * docs/screens. It stands in for the creator wherever her voice appears: the
 * app header, her reflection at the end of a story, her posts in Community.
 *
 * A reader's own avatar is never this; readers are anonymous and get their
 * pseudonym's initial instead.
 */
export function Mark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <img
      src={portrait}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
