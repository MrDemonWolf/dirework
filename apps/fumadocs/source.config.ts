import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from "fumadocs-mdx/config";

import { rehypeA11y } from "./src/lib/rehype-a11y";

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // GitHub's high-contrast pair: on the dark code background every token clears 7:1; on
    // the light one comments sit at 4.6:1 and everything else clears 7:1. The default
    // github-light/dark pair put dark-mode comments at 3.6:1.
    rehypeCodeOptions: {
      themes: { light: "github-light-high-contrast", dark: "github-dark-high-contrast" },
    },
    // After rehype-code, so code blocks are already highlighted when they are named.
    rehypePlugins: (plugins) => [...plugins, rehypeA11y],
  },
});
