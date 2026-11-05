// Source pins for the Bot settings card frame: every card (live and placeholder) renders
// through `SettingsCard`, so a change to the frame's padding, header rule or title type is
// one edit, and a progressive placeholder keeps repeating its live card box for box.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

/** Every .tsx under a directory, relative to src. */
function tsxFiles(dir: string): string[] {
  return readdirSync(path.join(src, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (statSync(path.join(src, rel)).isDirectory()) return tsxFiles(rel);
    return name.endsWith(".tsx") ? [rel] : [];
  });
}

const BOT_SETTINGS_FILES = [
  ...tsxFiles("app/(app)/dashboard/bot"),
  ...tsxFiles("components/bot-settings"),
  "components/bot-settings-skeleton.tsx",
];
const SETTINGS_CARD = path.join("components", "bot-settings", "settings-card.tsx");

/** Every source file under src, for the title-literal check. */
function allSources(dir = ""): string[] {
  return readdirSync(path.join(src, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (statSync(path.join(src, rel)).isDirectory()) {
      return name === "__tests__" ? [] : allSources(rel);
    }
    return /\.tsx?$/.test(name) ? [rel] : [];
  });
}

/** The `<SettingsCard` blocks a file renders, each by its title. */
function settingsCardTitles(source: string): string[] {
  return [...source.matchAll(/<SettingsCard\s[\s\S]*?title=(?:"([^"]+)"|\{([^}]+)\})/g)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
}

describe("Bot settings card frame", () => {
  it("draws the panel Card frame only in settings-card.tsx", () => {
    const offenders = BOT_SETTINGS_FILES.filter(
      (file) => file !== SETTINGS_CARD && /<Card\s+className="panel"/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("types the panel title class only in lib/panel-header.ts", () => {
    const offenders = allSources().filter(
      (file) =>
        file !== path.join("lib", "panel-header.ts") &&
        read(file).includes("font-heading text-lg font-semibold tracking-tight"),
    );
    expect(offenders).toEqual([]);
  });

  it("titles SettingsCard with PANEL_TITLE_CLASS", () => {
    expect(read(SETTINGS_CARD)).toMatch(/<CardTitle as="h2" className=\{PANEL_TITLE_CLASS\}>/);
  });

  it("renders all 8 live cards through SettingsCard", () => {
    const live = {
      "app/(app)/dashboard/bot/(sections)/replies/replies-page.tsx": ["Replies"],
      // The two command-group cards share one component, titled by `label`.
      "app/(app)/dashboard/bot/(sections)/commands/commands-page.tsx": [
        "label",
        "Always on",
        "Aliases",
      ],
      "components/bot-settings/bot-account-card.tsx": ["Bot account"],
      "components/bot-settings/bot-console-card.tsx": ["Run the bot"],
      "components/bot-settings/blocked-viewers-card.tsx": ["Blocked viewers"],
      "components/bot-settings/bot-live-controls.tsx": ["Live controls"],
    };
    for (const [file, titles] of Object.entries(live)) {
      expect(settingsCardTitles(read(file)), file).toEqual(titles);
    }
  });

  it("renders every placeholder card through SettingsCard", () => {
    const skeleton = read("components/bot-settings-skeleton.tsx");
    expect(skeleton).not.toContain("PlaceholderCard");
    // The two command groups share one placeholder, titled by `title`.
    expect(settingsCardTitles(skeleton)).toEqual([
      "Live controls",
      "Bot account",
      "Run the bot",
      "title",
      "Always on",
      "Aliases",
      "Replies",
      "Blocked viewers",
    ]);
  });
});
