import { ImageResponse } from "next/og";

// Branded default OG / Twitter card for the docs home and any page without its
// own image. Per-doc pages override this via generateMetadata (og/docs route).
export const alt = "Dirework — self-hosted Pomodoro timer and task list for Twitch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required for `output: export` (static GitHub Pages build) — pre-render at build.
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(125deg, #123a56 0%, #0E0B16 46%)",
        padding: "68px 72px",
        fontFamily: "sans-serif",
      }}
    >
      {/* wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg
          width="46"
          height="46"
          viewBox="0 0 64 64"
          fill="none"
          stroke="#29B6F0"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>Dirework logo</title>
          <path d="M14 30L20 8l10 18" />
          <path d="M50 30L44 8l-10 18" />
          <path d="M12 30c-1 10 4 18 12 22l8 6 8-6c8-4 13-12 12-22" />
          <circle cx="23" cy="36" r="2.5" fill="#29B6F0" />
          <circle cx="41" cy="36" r="2.5" fill="#29B6F0" />
          <path d="M28 46l4 4 4-4" />
          <circle cx="32" cy="24" r="7" strokeWidth="2.5" />
          <line x1="32" y1="24" x2="32" y2="19" strokeWidth="2.5" />
          <line x1="32" y1="24" x2="36" y2="24" strokeWidth="2.5" />
        </svg>
        <div style={{ fontSize: 34, fontWeight: 800, color: "#F5F3FF" }}>Dirework</div>
      </div>

      {/* headline + timer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 66,
                fontWeight: 800,
                color: "#F5F3FF",
                lineHeight: 1.04,
                letterSpacing: -2,
              }}
            >
              Focus together,
            </div>
            <div
              style={{
                fontSize: 66,
                fontWeight: 800,
                color: "#29B6F0",
                lineHeight: 1.04,
                letterSpacing: -2,
              }}
            >
              stream better.
            </div>
          </div>
          <div
            style={{
              fontSize: 25,
              color: "#A8A2B8",
              marginTop: 26,
              lineHeight: 1.35,
            }}
          >
            A self-hosted Pomodoro timer and shared task list with Twitch chat, on your own
            Cloudflare account.
          </div>
        </div>

        {/* timer module */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: 250,
            height: 250,
            borderRadius: 56,
            background: "#171221",
            border: "1px solid #2A2438",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              fontSize: 20,
              letterSpacing: 3,
              color: "#34C759",
              fontWeight: 700,
            }}
          >
            FOCUS
          </div>
          <div
            style={{
              fontSize: 74,
              fontWeight: 800,
              color: "#F5F3FF",
              lineHeight: 1,
            }}
          >
            18:32
          </div>
          <div style={{ fontSize: 17, color: "#A8A2B8" }}>Pomo 2 of 4</div>
        </div>
      </div>

      {/* footer badges */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: "#A8A2B8",
          fontSize: 21,
          fontFamily: "monospace",
        }}
      >
        <div>Self-hosted</div>
        <div>·</div>
        <div>Twitch-native</div>
        <div>·</div>
        <div>Open source</div>
      </div>
    </div>,
    { ...size },
  );
}
