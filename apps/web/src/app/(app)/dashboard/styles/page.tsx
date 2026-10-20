import type { Metadata } from "next";

import { requireSession } from "@/lib/auth-guard";
import StylesPage from "./styles-page";

export const metadata: Metadata = { title: "Theme Center" };

export default async function StylesRoute() {
  await requireSession();

  return (
    <>
      {/* The live preview renders the overlays' configured faces inline (not in an iframe),
          so this page loads the overlay font stylesheet like the (overlay) layout does. */}
      <link rel="stylesheet" href="/fonts/fonts.css" precedence="default" />
      <StylesPage />
    </>
  );
}
