import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The dashboard timer console shares one TimerContext value between its four consumers
 * (phase chip, instrument, transport, settings). React Compiler memoizes that value on the
 * things it is built from, so it only stays put across a provider render when every one of
 * them does. A `useMutation` result is a new object on every render; a value built from one
 * changes every time, and every consumer re-renders with it (a blur autosave's pending and
 * success renders, an OBS tab or live-preview toggle). The handles must come from the
 * mutation's stable members (`mutate`, `isPending`) instead.
 *
 * Compiled here with the same Babel and compiler Next uses, so the test reads the guards the
 * shipped code runs, not the source's spelling.
 */

const webRoot = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(webRoot, "package.json"));
const babel = require("next/dist/compiled/babel/core") as {
  transformSync: (code: string, opts: Record<string, unknown>) => { code: string } | null;
};

const file = path.join(webRoot, "src/components/timer-controls.tsx");

function compiledFunction(name: string): string {
  const out = babel.transformSync(readFileSync(file, "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [
      [
        require.resolve("next/dist/compiled/babel/preset-typescript"),
        { isTSX: true, allExtensions: true },
      ],
    ],
    plugins: [[require.resolve("babel-plugin-react-compiler"), {}]],
  });
  const code = out?.code ?? "";
  const start = code.indexOf(`function ${name}(`);
  expect(start, `${name} in the compiled output`).toBeGreaterThan(-1);
  const next = code.indexOf("\nexport function ", start + 1);
  return code.slice(start, next === -1 ? undefined : next);
}

/** Whole mutation objects: new on every render, so no memo guard may compare them. */
const MUTATION_RESULTS = ["start", "pause", "resume", "skip", "reset", "updateTimerConfig"];

describe("TimerProvider", () => {
  const provider = compiledFunction("TimerProvider");
  /** Every value a compiled memo guard compares (`$[n] !== <value>`). */
  const guarded = new Set(
    [...provider.matchAll(/\$\[\d+\] !== ([\w$.?]+)/g)].map((match) => match[1]),
  );

  it("is compiled with memo guards", () => {
    expect(provider).toContain("TimerContext.Provider");
    expect(guarded.size).toBeGreaterThan(0);
  });

  it.each(MUTATION_RESULTS)("never keys a memo on the whole %s mutation", (name) => {
    expect([...guarded]).not.toContain(name);
  });
});
