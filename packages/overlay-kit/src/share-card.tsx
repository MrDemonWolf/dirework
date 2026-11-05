/**
 * @dirework/overlay-kit/share-card — the social share card both apps serve as their default
 * `opengraph-image` (apps/web and apps/fumadocs), so its copy, colors and mark change in one
 * place. Each app renders it with `next/og` at build time; no request renders it.
 *
 * A subpath of its own because it is the package's only JSX: it needs `react` (a peer
 * dependency, for the automatic JSX runtime), while the "." entry that the overlays and docs
 * mocks import stays dependency-free.
 *
 * Next derives the `og:image` URL's `?<hash>` from each route file's own source, not from this
 * module, so a change made only here keeps the old URL, and a social site that cached the card
 * by URL can show the old one until its cache expires.
 */

import { BRAND, DEMO_SESSION, cycleLabel, formatClock } from "./index";

/** The standard 1.91:1 Open Graph card size; Next.js emits it as og:image width/height. */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;
/** Alt text Next.js emits as `og:image:alt` and `twitter:image:alt`. */
export const SHARE_CARD_ALT = BRAND.title;

const ACCENT = "#29B6F0";
const TEXT = "#ffffff";
const MUTED = "#adbbd3";
// Satori wants plain strings, so the copy and demo numbers are computed up front.
const HEADLINE = `${BRAND.tagline}.`;
const PHASE = DEMO_SESSION.phaseLabel.toUpperCase();
const CLOCK = formatClock(DEMO_SESSION.remainingMs);
const CYCLE = cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total);

/**
 * The card, drawn for `next/og` (Satori): inline styles only, every multi-child div needs an
 * explicit `display: "flex"`, and colors are literal hex because CSS variables and the apps'
 * stylesheets are not available there. No hooks: Satori calls it as a plain function. The
 * wolf-and-clock mark matches the web header logo and the docs `BrandMark`.
 */
export function ShareCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #091533 0%, #0b1b3d 100%)",
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
          stroke={ACCENT}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          // Not a <title>: Satori draws an SVG's <title> as visible text over the mark.
          role="img"
          aria-label="DireWork logo"
        >
          <path d="M14 30L20 8l10 18" />
          <path d="M50 30L44 8l-10 18" />
          <path d="M12 30c-1 10 4 18 12 22l8 6 8-6c8-4 13-12 12-22" />
          <circle cx="23" cy="36" r="2.5" fill={ACCENT} />
          <circle cx="41" cy="36" r="2.5" fill={ACCENT} />
          <path d="M28 46l4 4 4-4" />
          <circle cx="32" cy="24" r="7" strokeWidth="2.5" />
          <line x1="32" y1="24" x2="32" y2="19" strokeWidth="2.5" />
          <line x1="32" y1="24" x2="36" y2="24" strokeWidth="2.5" />
        </svg>
        <div style={{ fontSize: 34, fontWeight: 800, color: TEXT }}>{BRAND.name}</div>
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
          <div
            style={{
              fontSize: 62,
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.06,
              letterSpacing: -2,
            }}
          >
            {HEADLINE}
          </div>
          <div
            style={{
              fontSize: 25,
              color: MUTED,
              marginTop: 26,
              lineHeight: 1.35,
            }}
          >
            {BRAND.description}
          </div>
        </div>

        {/* timer module: the shared demo session's numbers */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: 250,
            height: 250,
            flexShrink: 0,
            borderRadius: 56,
            background: "#10224a",
            border: "1px solid #24406f",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ fontSize: 20, letterSpacing: 3, color: ACCENT, fontWeight: 700 }}>
            {PHASE}
          </div>
          <div style={{ fontSize: 74, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{CLOCK}</div>
          <div style={{ fontSize: 17, color: MUTED }}>{CYCLE}</div>
        </div>
      </div>

      {/* footer badges */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: MUTED,
          fontSize: 21,
          fontFamily: "monospace",
        }}
      >
        <div>Open source</div>
        <div>·</div>
        <div>Self-hosted on Cloudflare</div>
        <div>·</div>
        <div>Made for Twitch</div>
      </div>
    </div>
  );
}
