import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { LoggerEvent } from "babel-plugin-react-compiler";
import { describe, expect, it } from "vitest";

/**
 * React Compiler gate. `reactCompiler: true` (next.config.ts) runs babel-plugin-react-compiler
 * over the client bundle with panicThreshold "none": a component the compiler can't handle ships
 * as plain React, with none of its memoization, and nothing says so. Next's config takes no
 * logger, so the build, lint and CI all stay silent.
 *
 * This test runs the same plugin, with the options Next builds for a production client bundle,
 * through Next's own copy of Babel, over every apps/web/src module (tests and .d.ts excluded).
 * Its memo slot counts match the chunks Turbopack ships.
 *
 * ALLOWED is the exact set of functions that may stay uncompiled. A bailout outside it
 * (CompileError, CompileSkip or PipelineError) fails, and so does an allowed function that
 * compiles again, so the list only shrinks (like token-bypass.test.ts). A "use no memo" opt-out
 * always fails: a module-level one even logs CompileSuccess while Next ships the module
 * uncompiled.
 *
 * The compiler is pinned to an exact version in apps/web/package.json, so a bump is its own PR,
 * which this test re-checks. Revisit the test if experimental.turbopackRustReactCompiler is ever
 * turned on: the Rust port, not this plugin, would then be what ships.
 */

// Empty: every client function compiles. An entry needs the compiler's reason beside it, and
// the next PR that rewrites the code removes it.
const ALLOWED: Record<string, readonly string[]> = {};

/** next.config.ts's `reactCompiler` value; the first test holds the two together. */
const REACT_COMPILER_CONFIG = true;

const WEB = fileURLToPath(new URL("../../../", import.meta.url));
const SRC = join(WEB, "src");
const nodeRequire = createRequire(import.meta.url);

type NextLoaderConfig = typeof import("next/dist/build/get-babel-loader-config");
type Compiler = typeof import("babel-plugin-react-compiler");

/** The few Babel shapes this test touches: Next's compiled Babel ships no types. */
interface AstNode {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number } };
  /** A function's own name, or a variable declarator's binding. */
  id?: { name?: string } | null;
  /** A directive's literal. */
  value?: { value: string };
}
interface AstPath {
  node: AstNode;
  parentPath: AstPath | null;
}
interface BabelFile {
  path: { traverse(visitor: Record<string, (path: AstPath) => void>): void };
}
interface Babel {
  transformSync(code: string, options: Record<string, unknown>): unknown;
}

/**
 * The plugin entry Next builds from REACT_COMPILER_CONFIG for a production client build (no
 * server pass, isDev false). Today: `{ environment: { enableNameAnonymousFunctions: false } }`,
 * with panicThreshold left at "none".
 */
function nextCompilerPlugin(): [path: string, options: Record<string, unknown>] {
  const { getReactCompilerLoader } = nodeRequire(
    "next/dist/build/get-babel-loader-config",
  ) as NextLoaderConfig;
  const plugin = getReactCompilerLoader(REACT_COMPILER_CONFIG, WEB, false, undefined, false)
    ?.options.reactCompilerPlugins?.[0];
  const [path, options] = Array.isArray(plugin) ? plugin : [];
  if (typeof path !== "string" || typeof options !== "object" || options === null) {
    throw new Error("Next no longer builds a [path, options] React Compiler plugin entry");
  }
  return [path, options as Record<string, unknown>];
}

const [PLUGIN_PATH, NEXT_OPTIONS] = nextCompilerPlugin();
const compiler = nodeRequire(PLUGIN_PATH) as Compiler;
const babel = nodeRequire("next/dist/compiled/babel/core") as Babel;
const syntaxTypescript = (
  nodeRequire("next/dist/compiled/babel/plugin-syntax-typescript") as { default: unknown }
).default;

/** A readable name for a function: its own, or the binding it is assigned to. */
function functionName(path: AstPath): string {
  if (path.node.id?.name) return path.node.id.name;
  let parent = path.parentPath;
  // memo(…) and forwardRef(…): the component is named by the binding that holds it.
  while (parent?.node.type === "CallExpression") parent = parent.parentPath;
  if (parent?.node.type === "VariableDeclarator" && parent.node.id?.name) {
    return parent.node.id.name;
  }
  return parent?.node.type === "ExportDefaultDeclaration" ? "default" : "<anonymous>";
}

interface Bailout {
  fn: string;
  line: number;
  why: string;
}

interface ModuleScan {
  bailouts: Bailout[];
  /** Lines of "use no memo" / "use no forget" directives, module or function level. */
  optOuts: number[];
  /** Memo cache slots per compiled function. */
  compiled: Map<string, number>;
}

function scanModule(filename: string, code: string): ModuleScan {
  const functions: { start: number; end: number; name: string }[] = [];
  const optOuts: number[] = [];
  const events: LoggerEvent[] = [];
  babel.transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    code: false,
    plugins: [
      [syntaxTypescript, { isTSX: filename.endsWith(".tsx") }],
      // `pre` runs before any visitor, so this indexes the AST the compiler is about to read.
      () => ({
        pre(file: BabelFile) {
          file.path.traverse({
            "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression"(path) {
              functions.push({
                start: path.node.start,
                end: path.node.end,
                name: functionName(path),
              });
            },
            Directive(path) {
              if (compiler.OPT_OUT_DIRECTIVES.has(path.node.value?.value ?? "")) {
                optOuts.push(path.node.loc.start.line);
              }
            },
          });
        },
      }),
      [
        compiler.default,
        {
          ...NEXT_OPTIONS,
          logger: { logEvent: (_: string, event: LoggerEvent) => events.push(event) },
        },
      ],
    ],
  });

  // The compiler reports a bailout at the function's location (CompileSkip: at its body), with
  // no name: the innermost function around that point is the one it skipped.
  const owner = (loc: { start: { index: number } } | null): string => {
    if (!loc) return "<module>";
    let best: { start: number; name: string } | undefined;
    for (const fn of functions) {
      const inside = fn.start <= loc.start.index && loc.start.index < fn.end;
      if (inside && (!best || fn.start > best.start)) best = fn;
    }
    return best?.name ?? "<module>";
  };
  const bailouts: Bailout[] = [];
  const compiled = new Map<string, number>();
  const bail = (loc: { start: { index: number; line: number } } | null, why: string) =>
    bailouts.push({ fn: owner(loc), line: loc?.start.line ?? 0, why });
  for (const event of events) {
    if (event.kind === "CompileSuccess") compiled.set(owner(event.fnLoc), event.memoSlots);
    if (event.kind === "CompileError") {
      bail(event.fnLoc, `${event.detail.category}: ${event.detail.reason}`);
    }
    if (event.kind === "CompileSkip") bail(event.fnLoc, event.reason);
    if (event.kind === "PipelineError") bail(event.fnLoc, event.data.split("\n")[0] ?? "");
  }
  return { bailouts, optOuts, compiled };
}

function scanFile(file: string): ModuleScan {
  return scanModule(join(SRC, file), readFileSync(join(SRC, file), "utf8"));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const FILES = sourceFiles(SRC)
  .map((file) => relative(SRC, file).split("\\").join("/"))
  .sort();

describe("React Compiler gate", () => {
  it("runs the exact compiler version apps/web pins, the copy Next resolves", () => {
    const pkg = JSON.parse(readFileSync(join(WEB, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const pinned = pkg.dependencies["babel-plugin-react-compiler"];
    // react.dev: without strong test coverage, pin the compiler to an exact version.
    expect(pinned, "pin babel-plugin-react-compiler to an exact version").toMatch(
      /^\d+\.\d+\.\d+$/,
    );
    const resolved = createRequire(PLUGIN_PATH)("babel-plugin-react-compiler/package.json") as {
      version: string;
    };
    expect(resolved.version, "the compiler copy Next loads").toBe(pinned);
    expect(
      readFileSync(join(WEB, "next.config.ts"), "utf8"),
      "next.config.ts changed `reactCompiler`: set REACT_COMPILER_CONFIG (and this check) to match",
    ).toMatch(/^\s*reactCompiler: true,$/m);
  });

  it.each(FILES)("%s has no bailout outside ALLOWED", (file) => {
    const { bailouts, optOuts } = scanFile(file);
    expect(optOuts, "a 'use no memo' directive ships its code unmemoized: remove it").toEqual([]);
    const allowed = ALLOWED[file] ?? [];
    const fresh = bailouts
      .filter((bailout) => !allowed.includes(bailout.fn))
      .map(({ fn, line, why }) => `${fn} (line ${line}): ${why}`);
    expect(fresh, "the React Compiler skips these functions: rewrite the code it names").toEqual(
      [],
    );
    const stale = allowed.filter((fn) => !bailouts.some((bailout) => bailout.fn === fn));
    expect(stale, "these compile now: remove them from ALLOWED in react-compiler.test.ts").toEqual(
      [],
    );
  });

  it("allow-lists only modules it scans", () => {
    const unknown = Object.keys(ALLOWED).filter((file) => !FILES.includes(file));
    expect(unknown, "no such module: rename or remove these ALLOWED entries").toEqual([]);
  });

  it("compiles the stream overlays, so the scan is not vacuous", () => {
    // Both render on stream for the whole session.
    expect(scanFile("components/timer-display.tsx").compiled.get("TimerDisplay")).toBeGreaterThan(
      0,
    );
    expect(
      scanFile("components/task-list-display.tsx").compiled.get("TaskListDisplay"),
    ).toBeGreaterThan(0);
  });

  it("detects the bailouts it guards against", () => {
    const fixture = scanModule(
      "fixture.tsx",
      [
        "export function Finally({ run }: { run: () => void }) {",
        "  const onClick = () => {",
        "    try { run(); } finally { console.warn('done'); }",
        "  };",
        "  return <button onClick={onClick} />;",
        "}",
        "export const OptedOut = () => {",
        "  'use no memo';",
        "  return <p />;",
        "};",
        "export function Compiled({ n }: { n: number }) {",
        "  return <p>{n * 2}</p>;",
        "}",
      ].join("\n"),
    );
    expect(fixture.bailouts.map(({ fn, line }) => `${fn}:${line}`)).toEqual([
      "Finally:1",
      "OptedOut:7",
    ]);
    expect(fixture.bailouts[0]?.why).toContain("TryStatement without a catch clause");
    expect(fixture.optOuts).toEqual([8]);
    expect([...fixture.compiled.keys()]).toEqual(["Compiled"]);

    // A module-level opt-out logs CompileSuccess, yet Next ships the module uncompiled.
    const optedOutModule = scanModule(
      "module.tsx",
      "'use no memo';\nexport function Plain() {\n  return <p />;\n}\n",
    );
    expect([...optedOutModule.compiled.keys()]).toEqual(["Plain"]);
    expect(optedOutModule.bailouts).toEqual([]);
    expect(optedOutModule.optOuts).toEqual([1]);
  });
});
