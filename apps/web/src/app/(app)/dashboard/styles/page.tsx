import type { Metadata } from "next";

import { requireSession } from "@/lib/auth-guard";
import StylesPage from "./styles-page";

export const metadata: Metadata = { title: "Theme Center" };

export default async function StylesRoute() {
  await requireSession();

  return <StylesPage />;
}
