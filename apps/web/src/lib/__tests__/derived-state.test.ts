// Components that derive state from a prop during render, never by copying it in an effect.
// An effect that sets state when a prop changes renders and commits the component twice per
// change, the first time with the stale value. The React Compiler (the copy the build runs)
// has a check for exactly that, `validateNoSetStateInEffects` (the rule behind eslint's
// react-hooks/set-state-in-effect); the build leaves it off, so this test runs it per file.
// A timer set in an effect that later clears state is fine: only a synchronous set counts.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { LoggerEvent, PluginOptions } from "babel-plugin-react-compiler";
import { describe, expect, it } from "vitest";

const load = createRequire(import.meta.url);
// Babel from Next's compiled bundle, the one `next build` runs the compiler with.
const babel = load("next/dist/compiled/babel/core") as {
  transformSync(code: string, options: Record<string, unknown>): unknown;
};
const reactCompiler = (load("babel-plugin-react-compiler") as { default: unknown }).default;

const src = path.resolve(import.meta.dirname, "../..");

/** The line a compiler location points at (it can also be a "generated code" marker). */
function lineOf(loc: unknown): number | "?" {
  return typeof loc === "object" && loc !== null && "start" in loc
    ? (loc as { start: { line: number } }).start.line
    : "?";
}

/** The components the compiler compiled in `file`, and everything it reported besides. */
function compile(file: string) {
  const compiled: string[] = [];
  const findings: string[] = [];
  const logEvent = (_filename: string | null, event: LoggerEvent) => {
    if (event.kind === "CompileSuccess") compiled.push(event.fnName ?? "<anonymous>");
    else if (event.kind === "CompileError") {
      const { category, reason } = event.detail;
      findings.push(`line ${lineOf(event.detail.primaryLocation())}: ${category}: ${reason}`);
    } else if (event.kind === "CompileSkip")
      findings.push(`line ${lineOf(event.loc ?? event.fnLoc)}: skipped: ${event.reason}`);
    else if (event.kind === "PipelineError")
      findings.push(`line ${lineOf(event.fnLoc)}: ${event.data}`);
  };
  const options: PluginOptions = {
    panicThreshold: "none",
    environment: { validateNoSetStateInEffects: true },
    logger: { logEvent },
  };
  babel.transformSync(readFileSync(path.join(src, file), "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    code: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [[reactCompiler, options]],
  });
  return { compiled, findings };
}

describe.each([
  ["components/theme-center/color-input.tsx", "ColorInput"],
  ["components/secret-url-row.tsx", "SecretUrlRow"],
])("%s", (file, component) => {
  it(`${component} never sets state synchronously in an effect`, () => {
    const { compiled, findings } = compile(file);
    // Compiled at all, so the check below really ran over it.
    expect(compiled).toContain(component);
    expect(findings).toEqual([]);
  });
});
