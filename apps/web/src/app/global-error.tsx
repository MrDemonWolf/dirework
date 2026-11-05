"use client";

import { useLayoutEffect } from "react";

import { isTransparentSurface, OVERLAY_SURFACE, THEME_INIT_SCRIPT } from "@/lib/theme-init";
import { SCHEME_HEX } from "@/tokens.generated";

/** The app is dark-first, and with no stylesheet there is no theme class to follow. */
const DARK = SCHEME_HEX.dark;

/** How long a crashed overlay or bot widget stays blank before it re-mounts (as (overlay)/error.tsx). */
const RECOVER_AFTER_MS = 10_000;

const ON_SURFACE = `html[data-surface="${OVERLAY_SURFACE}"]`;

/**
 * On an OBS overlay or the bot's blank widget the crash page must never paint over the
 * stream: transparent canvas, the notice kept for screen readers only (sr-only), no button.
 * `!important` beats the inline background and padding.
 */
const SURFACE_CSS =
  `${ON_SURFACE},${ON_SURFACE} body{background:transparent !important}` +
  `${ON_SURFACE} main{position:absolute;width:1px;height:1px;margin:-1px;padding:0 !important;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}` +
  `${ON_SURFACE} main button{display:none}`;

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * root layout, so it renders its own <html>/<head>/<body> and styles inline (the app
 * stylesheet may not have loaded), in the dark palette's generated hex
 * (tokens.generated.ts): background, foreground and muted text, and the dark
 * outline button's `--input` border.
 *
 * Overlays and the bot widget: the root layout's own <head> script (lib/theme-init.ts)
 * marks them `data-surface="overlay"` before paint when this page is server-rendered; on a
 * client render no script runs (and React resets <html>'s attributes), so the layout effect
 * re-marks it before paint. There it also resets itself, since nobody is watching to click.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  useLayoutEffect(() => {
    if (!isTransparentSurface(location.pathname, location.search)) return;
    document.documentElement.setAttribute("data-surface", OVERLAY_SURFACE);
    const timer = setTimeout(reset, RECOVER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    // suppressHydrationWarning: the inline script sets attributes on <html> before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>DireWork hit an error</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: SURFACE_CSS }} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: DARK.background,
          color: DARK.foreground,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>DireWork hit an error</h1>
          <p role="status" style={{ margin: "0 0 16px", color: DARK["muted-foreground"] }}>
            Try again, or reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${DARK.input}`,
              background: "transparent",
              color: "inherit",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
