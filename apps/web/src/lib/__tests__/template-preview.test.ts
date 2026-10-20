import { describe, expect, it } from "vitest";

import { interpolate } from "@dirework/api/chat-text";

import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import { taskMessageFields, timerMessageFields } from "@/lib/message-fields";
import { previewVars } from "@/lib/template-preview";

describe("reply preview sample values", () => {
  const vars = previewVars("Streamer");

  // The field lists are typed against the variable registry, so an unknown chip can't compile;
  // this guards the runtime half — every offered variable fills with something visible.
  it("have a non-empty sample for every variable the editors offer", () => {
    const offered = new Set(
      [...taskMessageFields, ...timerMessageFields].flatMap((field) => field.variables),
    );
    expect(offered.size).toBeGreaterThan(0);
    for (const name of offered) {
      expect(vars[name], name).toBeTruthy();
    }
  });

  it("fill every default message with no placeholder left behind", () => {
    const templates = [
      ...Object.values(DEFAULT_TASK_MESSAGES),
      ...Object.values(DEFAULT_TIMER_MESSAGES),
    ];
    for (const template of templates) {
      expect(interpolate(template, vars)).not.toMatch(/\{\w+\}/);
    }
  });

  it("stand the streamer in for the viewer and the channel", () => {
    expect(interpolate("{user} in #{channel}", vars)).toBe("Streamer in #Streamer");
  });
});
