import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { contrastRatio, parseHex } from "./helpers/wcag";

/**
 * Contrast of the bot dock's OBS Yami palette (`color.obs` in design-system/tokens.json),
 * pair by pair as `bot-dock.tsx` and `bot-dock-view.tsx` use it. The dock is a real UI (an
 * OBS custom browser dock), so text is held to WCAG AA (4.5:1) and the focus outline, a
 * non-text indicator, to 3:1 against every surface it can sit on. Disabled buttons are
 * exempt (WCAG 1.4.3 excludes inactive controls).
 */

const tokens = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../../design-system/tokens.json", import.meta.url)),
    "utf8",
  ),
) as { color: { obs: Record<string, string> } };

const obs = tokens.color.obs;

function contrast(a: string, b: string): number {
  return contrastRatio(parseHex(a), parseHex(b));
}

const TEXT_AA = 4.5;
const NON_TEXT_AA = 3;

// [text token, surface token]: every pairing the dock renders.
const TEXT_PAIRS: [string, string][] = [
  ["text", "window"], // body copy, activity lines
  ["text", "base"], // status rows, recent commands
  ["text", "title"], // the sticky title bar
  ["text", "control"], // default buttons
  ["text", "controlHover"], // default buttons, hovered
  ["text", "primary"], // the primary button
  ["text", "primaryHover"], // the primary button, hovered
  ["muted", "window"], // section headings, hints, timestamps
  ["muted", "base"], // <dt> labels, "waiting for chat…", timestamps in the list
  ["muted", "title"],
  ["green", "window"], // command replies
  ["green", "base"],
  ["red", "window"], // errors
  ["red", "base"], // error lines in the recent-commands list
  ["red", "title"],
  ["yellow", "window"], // the standby notice
  ["yellow", "base"],
];

const FOCUS_SURFACES = ["window", "base", "title"];

describe("bot dock (OBS Yami) palette contrast", () => {
  it("checks a real token for every pair", () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect(obs[fg], fg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(obs[bg], bg).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(TEXT_PAIRS)("%s text on %s meets AA", (fg, bg) => {
    expect(contrast(obs[fg]!, obs[bg]!)).toBeGreaterThanOrEqual(TEXT_AA);
  });

  // The ring is drawn outside the control (outline-offset), on the surface around it.
  it.each(FOCUS_SURFACES)("focus outline on %s meets 3:1", (bg) => {
    expect(contrast(obs.focus!, obs[bg]!)).toBeGreaterThanOrEqual(NON_TEXT_AA);
  });
});
