import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** Inline brand mark — a squircle timer ring, the product's signature motif. */
function BrandMark() {
  return (
    <span
      data-dw-brand
      className="inline-flex items-center gap-2.5"
      style={{ lineHeight: 1 }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect
          x="2.5"
          y="2.5"
          width="21"
          height="21"
          rx="7"
          stroke="var(--hairline)"
          strokeWidth="2.5"
        />
        {/* ~70% progress arc in brand cerulean */}
        <path
          d="M13 2.5 h4 a7 7 0 0 1 6.5 7 v7 a7 7 0 0 1 -7 7 h-9"
          stroke="var(--brand-500)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
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
        Dirework
      </span>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <BrandMark />,
      url: "/",
      transparentMode: "top",
    },
    githubUrl: "https://github.com/mrdemonwolf/dirework",
    links: [
      // Landing-section anchors. On the home page these scroll; from any other
      // page they navigate home and then jump to the section.
      { text: "Features", url: "/#features" },
      { text: "Overlays", url: "/#overlays" },
      { text: "Themes", url: "/#themes" },
      { text: "Compare", url: "/#compare" },
      { text: "Docs", url: "/docs" },
      { text: "Support", url: "https://mrdwolf.net/discord" },
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
