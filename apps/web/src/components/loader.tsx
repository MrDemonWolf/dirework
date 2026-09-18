/**
 * Branded loading state — a spinning focus ring (the Dirework Pomodoro motif)
 * instead of a generic spinner. Inherits theme colors via CSS variables.
 */
export default function Loader() {
  return (
    <div
      className="flex h-full items-center justify-center pt-8"
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 48 48" className="size-8 animate-spin [animation-duration:1.1s]">
        <title>Loading</title>
        <circle cx="24" cy="24" r="20" fill="none" className="stroke-border" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          className="stroke-primary"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="40 126"
        />
      </svg>
    </div>
  );
}
