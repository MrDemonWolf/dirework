import type { MetadataRoute } from "next";

import { BRAND } from "@dirework/overlay-kit";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${BRAND.links.docs}/sitemap.xml`,
  };
}
