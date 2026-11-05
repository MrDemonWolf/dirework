/**
 * @dirework/overlay-kit/share-card — the social share card both apps serve (apps/web as the
 * static public/og.png that scripts/render-og.ts renders before each build, apps/fumadocs as its
 * `opengraph-image`), so its copy, colors and mark change in one place. Each app renders it
 * with `next/og` at build time; no request renders it.
 *
 * A subpath of its own because it is the package's only JSX: it needs `react` (a peer
 * dependency, for the automatic JSX runtime), while the "." entry that the overlays and docs
 * mocks import stays dependency-free.
 *
 * Neither URL changes when this module does (the web card is a fixed /og.png; Next derives the
 * docs `og:image` URL's `?<hash>` from the route file's own source), so a social site that
 * cached the card by URL can show the old one until its cache expires.
 */

import { BRAND, BRAND_MARK, DEMO_SESSION, cycleLabel, formatClock } from "./index";
import { SHARE_CARD_COLORS } from "./share-card-colors.generated";

/** The standard 1.91:1 Open Graph card size, emitted as og:image width/height. */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;
/** Alt text Next.js emits as `og:image:alt` and `twitter:image:alt`. */
export const SHARE_CARD_ALT = BRAND.title;

// The app's neutral dark palette and blue accent, as hex from design-system/tokens.json.
const { background: BACKGROUND, surface: SURFACE, border: BORDER } = SHARE_CARD_COLORS;
const { accent: ACCENT, text: TEXT, muted: MUTED } = SHARE_CARD_COLORS;
// Satori wants plain strings, so the copy and demo numbers are computed up front.
const HEADLINE = `${BRAND.tagline}.`;
const PHASE = DEMO_SESSION.phaseLabel.toUpperCase();
const CLOCK = formatClock(DEMO_SESSION.remainingMs);
const CYCLE = cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total);

/**
 * The card, drawn for `next/og` (Satori): inline styles only, every multi-child div needs an
 * explicit `display: "flex"`, and colors are hex (`SHARE_CARD_COLORS`, generated from the
 * tokens) because CSS variables and the apps' stylesheets are not available there. No hooks: Satori calls it as a plain function. The
 * wolf-and-clock mark is `BRAND_MARK`, as in the web header logo and the docs `BrandMark`.
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
        // The page background, lifting toward the card surface in the far corner.
        background: `linear-gradient(135deg, ${BACKGROUND} 0%, ${BACKGROUND} 45%, ${SURFACE} 100%)`,
        padding: "68px 72px",
        fontFamily: "sans-serif",
      }}
    >
      {/* wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg
          width="46"
          height="46"
          viewBox={BRAND_MARK.viewBox}
          fill="none"
          stroke={ACCENT}
          strokeWidth={BRAND_MARK.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Not a <title>: Satori draws an SVG's <title> as visible text over the mark.
          role="img"
          aria-label="DireWork logo"
        >
          {BRAND_MARK.paths.map((d) => (
            <path key={d} d={d} />
          ))}
          {BRAND_MARK.eyes.map((eye) => (
            <circle key={eye.cx} {...eye} fill={ACCENT} stroke="none" />
          ))}
          <circle {...BRAND_MARK.clock.face} strokeWidth={BRAND_MARK.clock.strokeWidth} />
          {BRAND_MARK.clock.hands.map((hand) => (
            <line key={hand.y2} {...hand} strokeWidth={BRAND_MARK.clock.strokeWidth} />
          ))}
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
            background: SURFACE,
            border: `1px solid ${BORDER}`,
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
