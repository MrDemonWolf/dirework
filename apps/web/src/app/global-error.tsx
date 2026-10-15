"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * root layout, so it renders its own <html>/<body> and styles inline (the app
 * stylesheet may not have loaded).
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
          background: "#141210",
          color: "#e7e5e4",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>DireWork hit an error</h1>
          <p style={{ margin: "0 0 16px", color: "#a8a29e" }}>Try again, or reload the page.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #57534e",
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
