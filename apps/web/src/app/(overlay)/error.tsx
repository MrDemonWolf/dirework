"use client";

import { useEffect } from "react";

/** How long a crashed overlay stays blank before it re-mounts and polls again. */
const RECOVER_AFTER_MS = 10_000;

/**
 * An overlay render error must never composite Next's error screen onto the
 * stream. Render nothing (transparent in OBS) and re-mount on a timer: the
 * React Query cache survives, so polling resumes as soon as the page renders.
 */
export default function OverlayError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const timer = setTimeout(reset, RECOVER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);

  return null;
}
