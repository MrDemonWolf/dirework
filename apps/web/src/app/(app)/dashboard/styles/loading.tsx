// Route-level loading UI for the Theme Center — see ../loading.tsx for why each dashboard route
// has one. Same skeleton the page renders until `config.get` resolves.

import { StylesSkeleton } from "@/components/styles-skeleton";

export default function StylesLoading() {
  return <StylesSkeleton />;
}
