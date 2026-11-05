"use client";

// The Theme Center as ONE progressive section (components/progressive-section.tsx,
// lib/progressive.ts): every part of the page reads `config.get`, so the whole page waits on
// it. The route streams the config (lib/server-query.ts `streamStyles`) and holds its first
// paint for at most SECTIONS_READY_MS; a config slower than that shows the StylesSkeleton in
// the page's place, and the page fills in from the same request. A client component so the
// query key comes from the browser's tRPC proxy, like the Bot settings sections (bot-data.tsx).

import type { ReactNode } from "react";

import { ProgressiveSection, SectionPlaceholder } from "@/components/progressive-section";
import { StylesSkeleton } from "@/components/styles-skeleton";
import { trpc } from "@/utils/trpc";

/** Renders `children` (the Theme Center) once the streamed `config.get` has settled. */
export function StylesSection({ children }: { children: ReactNode }) {
  return (
    <ProgressiveSection
      queryKeys={[trpc.config.get.queryKey()]}
      fallback={
        <SectionPlaceholder name="styles">
          <StylesSkeleton />
        </SectionPlaceholder>
      }
    >
      {children}
    </ProgressiveSection>
  );
}
