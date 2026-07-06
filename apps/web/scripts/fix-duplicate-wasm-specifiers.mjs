// next/og (used by src/app/opengraph-image.tsx) imports its .wasm deps under
// two specifiers for the same file — "foo.wasm" and "foo.wasm?module".
// Alchemy's own esbuild bundling step dedupes wasm modules by that raw
// specifier string, so it ends up uploading the same wasm twice under one
// name, and Cloudflare rejects the worker upload. Stripping "?module" here
// makes both specifiers identical so Alchemy's dedup collapses them.
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), ".open-next");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.m?js$/.test(entry.name)) {
        const content = await fs.readFile(full, "utf8");
        if (content.includes(".wasm?module")) {
          await fs.writeFile(full, content.replaceAll(".wasm?module", ".wasm"));
        }
      }
    }),
  );
}

await walk(root);
