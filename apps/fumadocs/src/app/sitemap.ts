import type { MetadataRoute } from "next";

import { source } from "@/lib/source";

const BASE = "https://mrdemonwolf.github.io/dirework";

// Static export → emit sitemap.xml at build for the GitHub Pages site.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = source.getPages().map((page) => ({
    url: `${BASE}${page.url}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [{ url: BASE, changeFrequency: "weekly", priority: 1 }, ...docs];
}
