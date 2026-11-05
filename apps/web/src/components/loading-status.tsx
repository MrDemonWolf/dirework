/** A screen-reader-only "Loading …" status for a page skeleton (sections stay aria-hidden). */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status">
      Loading {label}…
    </span>
  );
}
