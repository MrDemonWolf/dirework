// Default social share card (Next.js `opengraph-image` file convention at the app root, so every
// route inherits it). Prerendered once at build and served from OpenNext's static-assets cache
// rather than rendered per request.

import { ImageResponse } from "next/og";

/** Alt text Next.js emits as `og:image:alt`. */
export const alt = "DireWork — Focus timer for your Twitch stream";
/** The standard 1.91:1 Open Graph card size; Next.js emits it as og:image width/height. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Renders the share card with `next/og` (Satori), which supports only inline styles and a
 * flexbox subset, so nothing here can use Tailwind classes or the app's CSS tokens.
 */
export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(125deg, #123a56 0%, #0E0B16 46%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Wolf-clock icon (simplified for OG); same paths as the header logo in header.tsx */}
      <svg width="120" height="120" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 32 }}>
        <title>DireWork logo</title>
        <path
          d="M14 30L20 8l10 18"
          stroke="#29B6F0"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M50 30L44 8l-10 18"
          stroke="#29B6F0"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 30c-1 10 4 18 12 22l8 6 8-6c8-4 13-12 12-22"
          stroke="#29B6F0"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23" cy="36" r="2.5" fill="#29B6F0" />
        <circle cx="41" cy="36" r="2.5" fill="#29B6F0" />
        <path
          d="M28 46l4 4 4-4"
          stroke="#29B6F0"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="24" r="7" stroke="#29B6F0" strokeWidth="2.5" />
        <line
          x1="32"
          y1="24"
          x2="32"
          y2="19"
          stroke="#29B6F0"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="24"
          x2="36"
          y2="24"
          stroke="#29B6F0"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.02em",
          marginBottom: 16,
        }}
      >
        DireWork
      </div>
      <div
        style={{
          fontSize: 28,
          color: "#29B6F0",
          fontWeight: 500,
        }}
      >
        Pomodoro timer and task list for Twitch co-working streams
      </div>
    </div>,
    { ...size },
  );
}
