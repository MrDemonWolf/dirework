"use client";

import { useEffect } from "react";
import { useParams, usePathname } from "next/navigation";

import { createCrashReporter, overlayCrashSurface } from "@/lib/crash-report";
import { publicTrpc } from "@/utils/trpc";

/** How long a crashed overlay stays blank before it re-mounts and polls again. */
const RECOVER_AFTER_MS = 10_000;

/**
 * One reporter per overlay page (module scope survives the re-mounts), so a crash loop sends
 * at most one report per 10 minutes. Static import: nothing is fetched at crash time.
 */
const reportCrash = createCrashReporter((input) => publicTrpc.crash.report.mutate(input));

/**
 * An overlay render error must never composite Next's error screen onto the
 * stream. Render nothing (transparent in OBS) and re-mount on a timer: the
 * React Query cache survives, so polling resumes as soon as the page renders.
 * The crash is reported by its name only, with the overlay's own token, direct
 * to the api (lib/crash-report.ts).
 */
export default function OverlayError({ error, reset }: { error: Error; reset: () => void }) {
  const surface = overlayCrashSurface(usePathname());
  const { token } = useParams<{ token?: string }>();

  useEffect(() => {
    reportCrash(surface, token, error);
  }, [surface, token, error]);

  useEffect(() => {
    const timer = setTimeout(reset, RECOVER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);

  return null;
}
