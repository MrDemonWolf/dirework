import type { MetadataRoute } from "next";

import { webOrigin } from "@/lib/api-origin";

// The app is single-tenant: only the public landing (and the pre-claim /setup)
// should be crawlable. Everything else is auth-gated or token-gated.
export default function robots(): MetadataRoute.Robots {
  const base = webOrigin();
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
