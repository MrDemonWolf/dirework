import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The docs site's static export, written by verify.yml's "Production build" step before the
 * suite runs (locally: `bun run build` in apps/fumadocs). The docs specs skip locally when it
 * is missing; in CI a missing export fails.
 */
export const DOCS_OUT = fileURLToPath(new URL("../../../apps/fumadocs/out", import.meta.url));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

/** The export's file for a URL path: exact file, `<path>.html`, or `<path>/index.html`. */
function resolveFile(urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(DOCS_OUT, candidate);
    if (file.startsWith(DOCS_OUT) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export interface DocsServer {
  origin: string;
  /** How many requests for a URL path reached the server (browser cache hits never do). */
  hits(path: string): number;
  close(): Promise<void>;
}

/**
 * Serve the export with GitHub Pages' caching header: every file `cache-control: max-age=600`
 * (live, 2026-11-04), so the browser caches what it caches in production. 86-docs-search
 * relies on it: without it the search index downloads twice. An unknown path gets 404.html.
 */
export async function serveDocs(): Promise<DocsServer> {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    seen.push(path);
    const file = resolveFile(path === "/" ? "/index.html" : path);
    res.writeHead(file ? 200 : 404, {
      "content-type": file ? (TYPES[extname(file)] ?? "application/octet-stream") : TYPES[".html"],
      "cache-control": "max-age=600",
    });
    res.end(readFileSync(file ?? join(DOCS_OUT, "404.html")));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    hits: (path) => seen.filter((seenPath) => seenPath === path).length,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
