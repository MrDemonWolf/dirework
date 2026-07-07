import { ImageResponse } from "next/og";

// Branded default OG / Twitter card for the docs home and any page without its
// own image. Per-doc pages override this via generateMetadata (og/docs route).
export const alt =
  "Dirework — self-hosted Pomodoro timer and task list for Twitch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required for `output: export` (static GitHub Pages build) — pre-render at build.
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
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
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "4px solid #29B6F0",
              borderRightColor: "transparent",
              transform: "rotate(-45deg)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 800, color: "#F5F3FF" }}>
            Dirework
          </div>
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
              A self-hosted Pomodoro timer and shared task list with Twitch chat,
              on your own Cloudflare account.
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
      </div>
    ),
    { ...size },
  );
}
