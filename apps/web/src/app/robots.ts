import type { MetadataRoute } from "next";

// The app is single-tenant: only the public landing (and the pre-claim /setup)
// should be crawlable. Everything else is auth-gated or token-gated.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/setup"],
        disallow: ["/dashboard", "/overlay", "/bot", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
