import { requireSession } from "@/lib/auth-guard";
import StylesPage from "./styles-page";

export default async function StylesRoute() {
  await requireSession();

  return <StylesPage />;
}
