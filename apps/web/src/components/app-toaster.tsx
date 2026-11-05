"use client";

// The app's one toast host, mounted by the (app) layout only. The OBS overlays and the bot page
// (the (overlay) and (bot) route groups) show no toasts, so neither sonner nor the query-error
// toast loads there.

import { setErrorReporters } from "@/lib/query-error-reporter";
import { toastMutationAuthLapse, toastQueryError } from "@/lib/query-error-toast";

import { Toaster } from "./ui/sonner";

// Sonner's own gutters (24px, 16px under 600px wide) plus the safe-area insets, which are
// non-zero on a phone with viewport-fit=cover (bottom: home indicator; left/right: the
// notch in landscape, where Sonner uses the desktop `offset`). While a SaveBar is shown,
// index.css sets `--save-bar-clearance` to its height, so toasts stack above it on every page
// that has one rather than over its Reset / Save buttons.
export const TOAST_OFFSET = {
  bottom: "calc(24px + var(--save-bar-clearance, 0px) + env(safe-area-inset-bottom, 0px))",
  left: "calc(24px + env(safe-area-inset-left, 0px))",
  right: "calc(24px + env(safe-area-inset-right, 0px))",
};
export const TOAST_MOBILE_OFFSET = {
  bottom: "calc(1rem + var(--save-bar-clearance, 0px) + env(safe-area-inset-bottom, 0px))",
  left: "calc(1rem + env(safe-area-inset-left, 0px))",
  right: "calc(1rem + env(safe-area-inset-right, 0px))",
};

// Failed queries, and writes refused because the sign-in lapsed, toast from here on (utils/query-client.ts
// reports through lib/query-error-reporter.ts).
// Registered as this module loads, before the (app) routes render or fetch anything, and never
// loaded lazily: "Can't reach the DireWork API" has to show when the network is down, when a
// chunk fetched on the first error would fail too.
setErrorReporters({ query: toastQueryError, mutation: toastMutationAuthLapse });

/** Sonner's `Toaster` with rich colors, clear of the notch, the home indicator and a SaveBar. */
export function AppToaster() {
  return <Toaster richColors offset={TOAST_OFFSET} mobileOffset={TOAST_MOBILE_OFFSET} />;
}
