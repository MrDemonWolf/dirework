// Shared Fumadocs layout options for the home (`(home)/layout.tsx`) and docs
// (`docs/layout.tsx`) layouts, plus the brand mark used in the nav and the site footer.

import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { BRAND, BRAND_MARK } from "@dirework/overlay-kit";

/**
 * Inline brand mark — the DireWork wolf-and-clock (`BRAND_MARK` from @dirework/overlay-kit,
 * shared with the web header and the share card) plus wordmark. Colored by
 * the `--brand-500` / `--txt-1` tokens so it follows the light/dark theme; the SVG is
 * decorative (the adjacent wordmark or the wrapping link's label names it).
 */
export function BrandMark() {
  return (
    <span data-dw-brand className="inline-flex items-center gap-2.5" style={{ lineHeight: 1 }}>
      <svg
        width="26"
        height="26"
        viewBox={BRAND_MARK.viewBox}
        fill="none"
        stroke="var(--brand-500)"
        strokeWidth={BRAND_MARK.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {BRAND_MARK.paths.map((d) => (
          <path key={d} d={d} />
        ))}
        {BRAND_MARK.eyes.map((eye) => (
          <circle key={eye.cx} {...eye} fill="var(--brand-500)" stroke="none" />
        ))}
        <circle {...BRAND_MARK.clock.face} strokeWidth={BRAND_MARK.clock.strokeWidth} />
        {BRAND_MARK.clock.hands.map((hand) => (
          <line key={hand.y2} {...hand} strokeWidth={BRAND_MARK.clock.strokeWidth} />
        ))}
      </svg>
      <span
        className="dw-display"
        style={{
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--txt-1)",
        }}
      >
        DireWork
      </span>
    </span>
  );
}

/**
 * Nav, GitHub link, top links, theme switch and search toggle shared by both layouts. A
 * function (not a constant) so each layout gets a fresh object it can extend.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <BrandMark />,
      url: "/",
      transparentMode: "top",
    },
    githubUrl: BRAND.links.repo,
    links: [
      // Landing-section anchors (ids in app/(home)/page.tsx), in page order. On the
      // home page these scroll; from any other page they navigate home and then jump
      // to the section.
      { text: "Features", url: "/#features" },
      { text: "Overlays & Themes", url: "/#overlays" },
      { text: "Chat", url: "/#chat" },
      { text: "Setup", url: "/#setup" },
      { text: "Docs", url: "/docs" },
      { text: "Support", url: BRAND.links.support },
    ],
    themeSwitch: {
      enabled: true,
      mode: "light-dark-system",
    },
    searchToggle: {
      enabled: true,
    },
  };
}
