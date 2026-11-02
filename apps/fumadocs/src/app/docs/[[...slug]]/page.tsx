// Catch-all docs page: renders any MDX page under content/docs (`/docs` and `/docs/**`) via the
// Fumadocs source loader. Every page is pre-rendered at build for the static GitHub Pages export.

import type { Metadata } from "next";

import { DocsBody, DocsDescription, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";

import { DocsPage } from "@/components/docs-page";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

/** Renders one docs page (title, description, MDX body, TOC); unknown slugs 404. */
export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    // DocsPage renders the <main> landmark itself (around its article), so the page adds
    // none; ours (components/docs-page.tsx) puts the table of contents in a <nav>.
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

/** Enumerates every docs slug so `output: "export"` can pre-render each page. */
export async function generateStaticParams() {
  return source.generateParams();
}

/**
 * Per-page title, description and canonical URL, plus OG / Twitter cards pointing at the
 * page's generated image from the `og/docs/[...slug]` route (see `getPageImage`).
 */
export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      type: "website",
      siteName: "DireWork",
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      images: [{ url: getPageImage(page).url, width: 1200, height: 630, alt: page.data.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: [{ url: getPageImage(page).url, alt: page.data.title }],
    },
  };
}
