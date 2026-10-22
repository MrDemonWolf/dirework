import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommandTabPanel } from "@/components/bot-settings/command-tab-panel";
import { metaCommands, taskCommands, timerCommands } from "@/lib/command-rows";
import {
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  type TaskMessagesConfig,
  type TimerMessagesConfig,
} from "@/lib/config-types";
import { taskMessageFields, timerMessageFields } from "@/lib/message-fields";
import { previewVars } from "@/lib/template-preview";

/**
 * The command tab's switch dims its legend and chips it "Off", but the meta commands
 * (`!dw help`, `!dwhelp`, …) answer even while task commands are off, so they must never be
 * shown as off with them. Renders the real panel with the rows the Bot settings page passes.
 */

const preview = { speaker: "bot", vars: previewVars("streamer") };
const noop = () => {};

function renderTaskTab(enabled: boolean): string {
  return renderToStaticMarkup(
    createElement(CommandTabPanel<TaskMessagesConfig>, {
      title: "Task commands",
      subtitle: "Viewers manage their tasks from chat",
      idPrefix: "task",
      enabled,
      onEnabledChange: noop,
      commands: taskCommands,
      fields: taskMessageFields,
      messages: DEFAULT_TASK_MESSAGES,
      savedMessages: DEFAULT_TASK_MESSAGES,
      filter: "",
      onFilterChange: noop,
      defaults: DEFAULT_TASK_MESSAGES,
      onMessagesChange: noop,
      preview,
    }),
  );
}

/** One rendered legend: its title, whether it reads as switched off, and its commands. */
interface Legend {
  title: string;
  dimmed: boolean;
  off: boolean;
  commands: string[];
}

/**
 * Each legend's list is `aria-labelledby` its title, so the header (title plus trailing
 * chips) is the markup between the title's id and the list that points at it.
 */
function legends(html: string): Legend[] {
  return [...html.matchAll(/<ul aria-labelledby="([^"]+)" class="([^"]*)">([\s\S]*?)<\/ul>/g)].map(
    ([, id, listClass, rows]) => {
      const titleAt = html.indexOf(`id="${id}"`);
      expect(titleAt).toBeGreaterThan(-1);
      const header = html.slice(titleAt, html.indexOf(`aria-labelledby="${id}"`));
      return {
        title: /^id="[^"]+"[^>]*>([^<]*)</.exec(header)?.[1] ?? "",
        dimmed: listClass!.split(/\s+/).includes("opacity-60"),
        off: />Off</.test(header),
        commands: [...rows!.matchAll(/<code class="font-mono text-xs[^"]*">([^<]*)<\/code>/g)].map(
          (match) => match[1]!,
        ),
      };
    },
  );
}

const switchable = taskCommands.filter((row) => !row.alwaysOn).map((row) => row.command);
const alwaysOn = metaCommands.map((row) => row.command);

describe("command tab legends", () => {
  it("keeps the always-on meta commands lit while task commands are off", () => {
    expect(legends(renderTaskTab(false))).toEqual([
      { title: "Command reference", dimmed: true, off: true, commands: switchable },
      { title: "Always on", dimmed: false, off: false, commands: alwaysOn },
    ]);
  });

  it("shows nothing as off while task commands are on", () => {
    expect(legends(renderTaskTab(true))).toEqual([
      { title: "Command reference", dimmed: false, off: false, commands: switchable },
      { title: "Always on", dimmed: false, off: false, commands: alwaysOn },
    ]);
  });

  it("gives a tab without always-on rows a single legend", () => {
    const html = renderToStaticMarkup(
      createElement(CommandTabPanel<TimerMessagesConfig>, {
        title: "Timer commands",
        subtitle: "Mods control the timer from chat",
        idPrefix: "timer",
        enabled: false,
        onEnabledChange: noop,
        commands: timerCommands,
        fields: timerMessageFields,
        messages: DEFAULT_TIMER_MESSAGES,
        savedMessages: DEFAULT_TIMER_MESSAGES,
        filter: "",
        onFilterChange: noop,
        defaults: DEFAULT_TIMER_MESSAGES,
        onMessagesChange: noop,
        preview,
      }),
    );
    expect(legends(html)).toEqual([
      {
        title: "Command reference",
        dimmed: true,
        off: true,
        commands: timerCommands.map((row) => row.command),
      },
    ]);
  });
});
