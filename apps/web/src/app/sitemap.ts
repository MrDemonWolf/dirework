import type { MetadataRoute } from "next";

// Only the landing is publicly indexable; dashboard/overlay/bot are gated.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
  return [{ url: base, changeFrequency: "weekly", priority: 1 }];
}
