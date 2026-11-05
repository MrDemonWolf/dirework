// Bot settings shell, shared by every sub-page (lib/bot-sections.ts): the heading and the
// sticky sub-nav. Synchronous and data-free, so it paints the moment a navigation lands; the
// session check and the data prefetch live one level down, in (sections)/layout.tsx, behind
// this folder's loading.tsx. That boundary also stops a header link's prefetch above them,
// so a prefetch never spends an api request.

import { BotSectionNav } from "@/components/bot-settings/bot-section-nav";
import { PageHeader } from "@/components/page-header";

export default function BotSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-content px-4 pt-8 pb-8">
      <PageHeader
        className="mb-5"
        title="Bot settings"
        description="Run the chat bot, choose its commands and replies, and moderate who can use them."
      />
      <BotSectionNav />
      {children}
    </div>
  );
}
