// Fumadocs content source for the docs site: the `/docs` page tree plus helpers for the
// per-page Open Graph image route and the `llms-full.txt` export.

import { type InferPageType, loader } from "fumadocs-core/source";
import { docs } from "fumadocs-mdx:collections/server";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [],
});

/**
 * Path of a page's generated Open Graph image. `segments` feeds the `og/docs/[...slug]` route's
 * static params; `url` goes into the page's metadata.
 */
export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}

/** A page as plain Markdown (title heading + processed body), concatenated into `llms-full.txt`. */
export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}

${processed}`;
}
