/**
 * Skeleton — brand loading placeholder (DEVELOPMENT_PLAN item 058).
 * Purely decorative: mark the container aria-hidden and announce the
 * loading state separately (role="status") for screen readers.
 */
export default function Skeleton({ className = '' }) {
  return <div className={`wn-skeleton ${className}`} aria-hidden="true" />;
}
