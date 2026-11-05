// The instant settings (Bot settings' mute switch, the command group switches and "Who can
// add tasks") save the moment they change and share one hook, lib/use-instant-setting.ts: the
// value shown while a save is in flight, and toasts raised by the mutation itself, so they
// still show when the page is left mid-save (a per-call `mutate(…, { onSuccess })` is dropped
// once its component unmounts).

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { instantValue } from "../use-instant-setting";

const read = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../..", file), "utf8");

describe("instantValue", () => {
  const pickMuted = (vars: { muted?: boolean }) => vars.muted;

  it("shows the live value when no save is in flight", () => {
    expect(
      instantValue({ pending: false, variables: undefined, live: true, pick: pickMuted }),
    ).toBe(true);
    // A finished save's variables linger on the mutation; the live value wins.
    expect(
      instantValue({ pending: false, variables: { muted: false }, live: true, pick: pickMuted }),
    ).toBe(true);
  });

  it("shows the value asked for while the save is in flight", () => {
    expect(
      instantValue({ pending: true, variables: { muted: false }, live: true, pick: pickMuted }),
    ).toBe(false);
  });

  it("falls back to the live value when the save in flight doesn't carry this setting", () => {
    expect(instantValue({ pending: true, variables: {}, live: true, pick: pickMuted })).toBe(true);
    expect(instantValue({ pending: true, variables: undefined, live: true, pick: pickMuted })).toBe(
      true,
    );
  });
});

describe("the instant settings", () => {
  it.each([
    "lib/use-command-group-switch.ts",
    "lib/use-task-access.ts",
    "components/bot-settings/bot-live-controls.tsx",
  ])("%s saves through useInstantSetting, never its own mutation", (file) => {
    const source = read(file);
    expect(source).toContain("useInstantSetting(");
    expect(source).not.toMatch(/\buseMutation\(/);
  });

  it("raises its toasts from the mutation's own callbacks, never a per-call one", () => {
    const hook = read("lib/use-instant-setting.ts");
    expect(hook).toContain("onError: toastMutationError(errorAction)");
    expect(hook).toMatch(
      /onSuccess: \(saved, sent\) => \{\s*toast\.success\(successText\(sent\)\);/,
    );
    // `set` hands over the variables alone.
    expect(hook).toMatch(/set: \(vars: TVariables\) => \{?\s*mutate\(vars\)/);
  });
});
