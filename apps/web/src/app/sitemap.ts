import type { MetadataRoute } from "next";

import { webOrigin } from "@/lib/api-origin";

// Only the landing is publicly indexable; dashboard/overlay/bot are gated.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = webOrigin();
  return [{ url: base, changeFrequency: "weekly", priority: 1 }];
}
