import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardBotLink } from "../../app/(bot)/bot/[token]/dashboard-bot-link";

describe("bot page dashboard link", () => {
  it("opens the dashboard in a new tab so the bot page (and its IRC socket) stays up", () => {
    const html = renderToStaticMarkup(createElement(DashboardBotLink));
    expect(html).toContain('href="/dashboard/bot"');
    expect(html).toContain('target="_blank"');
    // noreferrer keeps the token-bearing bot URL out of the dashboard's Referer header.
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
