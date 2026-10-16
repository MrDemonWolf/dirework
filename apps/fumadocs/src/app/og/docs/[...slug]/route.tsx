// Per-docs-page Open Graph image (1200x630 PNG), served at `/og/docs/<slug...>/image.png`.
// URLs come from `getPageImage` in lib/source.ts; docs pages link to them in generateMetadata.

import { generate as DefaultImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { getPageImage, source } from "@/lib/source";

// Never revalidate: each image is rendered once at build for the static export.
export const revalidate = false;

/** Renders the Fumadocs default OG card for the page's title and description. */
export async function GET(_req: Request, { params }: RouteContext<"/og/docs/[...slug]">) {
  const { slug } = await params;
  // Drop the trailing "image.png" segment that getPageImage appends to the page's slugs.
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return new ImageResponse(
    <DefaultImage title={page.data.title} description={page.data.description} site="DireWork" />,
    {
      width: 1200,
      height: 630,
    },
  );
}

/** One image per docs page, using the same segments as the URL from getPageImage. */
export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: getPageImage(page).segments }));
}
