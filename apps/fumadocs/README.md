# Dirework Docs

The Dirework documentation and marketing site, built with
[Fumadocs](https://fumadocs.dev) on Next.js as a static export.

## Development

From the repo root, `bun run dev` starts the docs alongside the API worker and web
app. To run only the docs:

```bash
cd apps/fumadocs
bun run dev
```

Open http://localhost:4000.

## Layout

| Path                          | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `content/docs/`               | MDX documentation pages                          |
| `src/app/(home)/`             | Landing page and its widgets                     |
| `src/app/docs/`               | Docs layout and page route                       |
| `src/app/api/search/route.ts` | Static Orama search index                        |
| `src/lib/source.ts`           | Content source adapter (`loader()`)              |
| `src/lib/layout.shared.tsx`   | Shared nav options for the home and docs layouts |
| `source.config.ts`            | Fumadocs MDX config (frontmatter schema)         |

## Build and deploy

`bun run build` writes the static site to `out/` (`output: "export"`; set
`NEXT_PUBLIC_BASE_PATH` to serve it under a sub-path). In CI the export is built and
uploaded by `.github/workflows/verify.yml` (`upload-docs: true`), and
`.github/workflows/deploy-docs-to-pages.yml` publishes that artifact to GitHub Pages.
