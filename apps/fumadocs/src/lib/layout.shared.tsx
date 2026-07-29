import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** Inline brand mark — the Dirework wolf-and-clock (wolf + Pomodoro). */
function BrandMark() {
  return (
    <span data-dw-brand className="inline-flex items-center gap-2.5" style={{ lineHeight: 1 }}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 64 64"
        fill="none"
        stroke="var(--brand-500)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M14 30L20 8l10 18" />
        <path d="M50 30L44 8l-10 18" />
        <path d="M12 30c-1 10 4 18 12 22l8 6 8-6c8-4 13-12 12-22" />
        <circle cx="23" cy="36" r="2.5" fill="var(--brand-500)" stroke="none" />
        <circle cx="41" cy="36" r="2.5" fill="var(--brand-500)" stroke="none" />
        <path d="M28 46l4 4 4-4" />
        <circle cx="32" cy="24" r="7" strokeWidth={2.5} />
        <line x1="32" y1="24" x2="32" y2="19" strokeWidth={2.5} />
        <line x1="32" y1="24" x2="36" y2="24" strokeWidth={2.5} />
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
      // Landing-section anchors, in the order the sections appear on the page.
      // On the home page these scroll; from any other page they navigate home
      // and then jump to the section.
      { text: "Overlays & Themes", url: "/#overlays" },
      { text: "Features", url: "/#features" },
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
