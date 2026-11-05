"use client";

import { SCHEME_HEX } from "@/tokens.generated";

/** The app is dark-first, and with no stylesheet there is no theme class to follow. */
const DARK = SCHEME_HEX.dark;

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * root layout, so it renders its own <html>/<body> and styles inline (the app
 * stylesheet may not have loaded), in the dark palette's generated hex
 * (tokens.generated.ts): background, foreground and muted text, and the dark
 * outline button's `--input` border.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
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
          <p style={{ margin: "0 0 16px", color: DARK["muted-foreground"] }}>
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
