// Bot settings shell, shared by every sub-page (lib/bot-sections.ts): the heading and the
// sticky sub-nav. Synchronous and data-free, so it paints the moment a navigation lands; the
// session check and the data prefetch live one level down, in (sections)/layout.tsx, behind
// this folder's loading.tsx. That boundary also stops a header link's prefetch above them,
// so a prefetch never spends an api request.

import { BotSectionNav } from "@/components/bot-settings/bot-section-nav";

export default function BotSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-content px-4 pt-8 pb-8">
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bot settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the chat bot, choose its commands and replies, and moderate who can use them.
        </p>
      </div>
      <BotSectionNav />
      {children}
    </div>
  );
}
