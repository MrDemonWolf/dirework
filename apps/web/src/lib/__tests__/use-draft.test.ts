import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { type DraftState, draftReducer, isDraftDirty, runSettingsSave } from "../use-draft";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

const seed = <T>(value: T): DraftState<T> => ({ draft: value, saved: value });

describe("draftReducer", () => {
  it("edit takes a value or an updater, and a no-op edit keeps the state", () => {
    const start = seed({ a: 1 });
    const edited = draftReducer(start, { type: "edit", next: { a: 2 } });
    expect(edited).toEqual({ draft: { a: 2 }, saved: { a: 1 } });
    const updated = draftReducer(edited, { type: "edit", next: (d) => ({ a: d.a + 1 }) });
    expect(updated.draft).toEqual({ a: 3 });
    expect(draftReducer(start, { type: "edit", next: start.draft })).toBe(start);
  });

  it("commit stores the submitted snapshot as saved and leaves the draft", () => {
    const submitted = { a: 2 };
    const state = draftReducer(seed({ a: 1 }), { type: "edit", next: submitted });
    const committed = draftReducer(state, { type: "commit", submitted });
    expect(committed.saved).toBe(submitted);
    expect(committed.draft).toBe(submitted);
    expect(isDraftDirty(committed)).toBe(false);
  });

  it("an edit made while the save is in flight stays dirty after the commit", () => {
    let state = draftReducer(seed({ a: 1 }), { type: "edit", next: { a: 2 } });
    const submitted = state.draft; // the save leaves with this
    state = draftReducer(state, { type: "edit", next: { a: 3 } }); // typed during the request
    state = draftReducer(state, { type: "commit", submitted }); // the answer lands
    expect(state.saved).toEqual({ a: 2 });
    expect(state.draft).toEqual({ a: 3 });
    expect(isDraftDirty(state)).toBe(true);
  });

  it("reset puts the saved snapshot back", () => {
    const state = draftReducer(seed({ a: 1 }), { type: "edit", next: { a: 5 } });
    const reset = draftReducer(state, { type: "reset" });
    expect(reset.draft).toBe(reset.saved);
    expect(isDraftDirty(reset)).toBe(false);
  });
});

describe("isDraftDirty", () => {
  it("compares deeply by default, so an edit reverted by hand is clean", () => {
    expect(isDraftDirty({ draft: { a: [1, 2] }, saved: { a: [1, 2] } })).toBe(false);
    expect(isDraftDirty({ draft: { a: [1, 2] }, saved: { a: [1, 3] } })).toBe(true);
  });

  it("honours a custom equals", () => {
    // Alias rows carry client ids that differ between a saved row and a re-added one.
    type Row = { id: string; key: string };
    const byKey = (a: Row[], b: Row[]) =>
      a.length === b.length && a.every((row, i) => row.key === b[i]?.key);
    const state = { draft: [{ id: "new-1", key: "t" }], saved: [{ id: "saved-0", key: "t" }] };
    expect(isDraftDirty(state)).toBe(true);
    expect(isDraftDirty(state, byKey)).toBe(false);
  });
});

describe("runSettingsSave", () => {
  const setup = (send: (p: string) => Promise<unknown>) => {
    const toasts = { error: vi.fn(), success: vi.fn(), failed: vi.fn() };
    const commit = vi.fn();
    const sendSpy = vi.fn(send);
    return { toasts, commit, send: sendSpy };
  };

  it("refuses a blocked save with a toast and sends nothing", async () => {
    const t = setup(async () => {});
    const ok = await runSettingsSave({
      noun: "styles",
      payload: "p",
      submitted: "s",
      blockedReason: "width: too big",
      ...t,
    });
    expect(ok).toBe(false);
    expect(t.send).not.toHaveBeenCalled();
    expect(t.commit).not.toHaveBeenCalled();
    expect(t.toasts.error).toHaveBeenCalledWith("Couldn't save styles: width: too big");
  });

  it("commits what was submitted and toasts success once the save lands", async () => {
    const t = setup(async () => {});
    const ok = await runSettingsSave({
      noun: "replies",
      payload: "p",
      submitted: "s",
      blockedReason: null,
      ...t,
    });
    expect(ok).toBe(true);
    expect(t.send).toHaveBeenCalledWith("p");
    expect(t.commit).toHaveBeenCalledWith("s");
    expect(t.toasts.success).toHaveBeenCalledWith("Replies saved");
  });

  it("a failed save toasts the error, commits nothing and never throws", async () => {
    const boom = new Error("boom");
    const t = setup(async () => {
      throw boom;
    });
    const ok = await runSettingsSave({
      noun: "aliases",
      payload: "p",
      submitted: "s",
      blockedReason: null,
      ...t,
    });
    expect(ok).toBe(false);
    expect(t.commit).not.toHaveBeenCalled();
    // Through toastMutationError, so an outage shares the one "can't reach the API" toast.
    expect(t.toasts.failed).toHaveBeenCalledWith("save aliases", boom);
    expect(t.toasts.error).not.toHaveBeenCalled();
    expect(t.toasts.success).not.toHaveBeenCalled();
  });
});

describe("editors on the shared save contract", () => {
  it("Theme Center uses useDraft and useSettingsSave, never its own snapshot state", () => {
    const page = read("app/(app)/dashboard/styles/styles-page.tsx");
    expect(page).toMatch(/useDraft(<\w+>)?\(/);
    expect(page).toContain("useSettingsSave(");
    expect(page).not.toMatch(/useState<\w*StylesConfig>|setSaved\w*\(/);
    expect(page).not.toContain("invalidateQueries");
  });
});
