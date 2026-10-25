// Loading placeholders for the Bot settings pages. The heading and sub-nav come from the
// route's layout and are never skeletons.
//
// Where they show:
//  - One placeholder per progressive card (`BotSection`, app/(app)/dashboard/bot/(sections)/
//    bot-data.tsx), only when the query that card reads missed the first-paint deadline
//    (lib/progressive.ts). Each repeats its live card's frame: the same Card, the real static
//    title and description, and skeleton blocks sized like the data-driven parts (measured at
//    1280px and 412px wide), so a card filling in does not move the page. Update them
//    alongside the cards in components/bot-settings/ and the pages.
//  - `BotSettingsSkeleton` on client navigation (bot/loading.tsx, (sections)/loading.tsx),
//    while the next page's server render round-trips.

import { taskMessageFields } from "@/lib/message-fields";
import { metaCommands, taskCommands, timerCommands } from "@/lib/command-rows";
import { CommandTable } from "@/components/bot-settings/command-table";
import { SectionPlaceholder } from "@/components/progressive-section";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The console card's body while its URL query is pending — also used inside the live card
 * (bot-console-card.tsx), so the page skeleton and the in-card placeholder can't drift.
 */
export function BotConsoleBodySkeleton() {
  return (
    <>
      {/* "<bot> chats in #<channel>", the bot page and dock URL rows, Open, "Where to keep it" */}
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-10.5 w-full rounded-xl" />
    </>
  );
}

/** A status chip: default (`h-6.75`) or `sm` (`h-5.5`). */
function ChipSkeleton({ className }: { className: string }) {
  return <Skeleton className={`rounded-full ${className}`} />;
}

/** The card frame every Bot settings card shares, with its real (static) title. */
function PlaceholderCard({
  title,
  description,
  action,
  contentClassName = "space-y-4",
  children,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </CardTitle>
        {action && <CardAction className="flex items-center">{action}</CardAction>}
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={`px-5 ${contentClassName}`}>{children}</CardContent>
    </Card>
  );
}

/**
 * Lines of text as skeleton bars, one per line box: `lines` from `sm` up, `narrow` below it
 * (where the copy wraps). `lineClassName` is the line box (`h-5` for text-sm, `h-4` text-xs).
 */
function TextLines({
  lines,
  narrow = lines,
  lineClassName = "h-5",
}: {
  lines: number;
  narrow?: number;
  lineClassName?: string;
}) {
  const count = Math.max(lines, narrow);
  return (
    <div>
      {Array.from({ length: count }, (_, i) => {
        // Shown only where the copy runs to this many lines.
        const visibility = i >= lines ? "sm:hidden" : i >= narrow ? "max-sm:hidden" : "";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed count of identical lines
          <div key={i} className={`flex items-center ${lineClassName} ${visibility}`}>
            <Skeleton className={`h-3/5 ${i === count - 1 ? "w-3/4" : "w-full"}`} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * One `ControlRow` of the live controls: label (+ the mute chip), description, control. The
 * descriptions are data-driven copy, so each row takes the line counts its copy runs to.
 */
function ControlRowSkeleton({
  chip = false,
  link = false,
  lines = 1,
  narrow = lines,
}: {
  chip?: boolean;
  link?: boolean;
  lines?: number;
  narrow?: number;
}) {
  return (
    <li className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className={`flex items-center gap-2 ${chip ? "h-6" : "h-5"}`}>
          <Skeleton className="h-4 w-24" />
          {chip && <ChipSkeleton className="h-5.5 w-18" />}
        </div>
        <TextLines lines={lines} narrow={narrow} />
      </div>
      {link ? (
        <Skeleton className="h-11 w-14 shrink-0" />
      ) : (
        <Skeleton className="h-4.6 w-8 shrink-0 rounded-full" />
      )}
    </li>
  );
}

/**
 * Overview → Live controls (needs `config.get`). The mute row's copy depends on whether a bot
 * account is connected (`user.me`); without that answer, the connected copy.
 */
export function LiveControlsPlaceholder({ hasBotAccount = true }: { hasBotAccount?: boolean }) {
  return (
    <SectionPlaceholder name="live-controls">
      <PlaceholderCard
        title="Live controls"
        description="Each switch takes effect as soon as you flip it."
        contentClassName=""
      >
        <ul className="divide-y divide-border/40">
          <ControlRowSkeleton chip lines={hasBotAccount ? 2 : 1} narrow={hasBotAccount ? 3 : 2} />
          <ControlRowSkeleton />
          <ControlRowSkeleton narrow={2} />
          <ControlRowSkeleton link />
        </ul>
      </PlaceholderCard>
    </SectionPlaceholder>
  );
}

/** Overview → Bot account, as it looks with an account connected (needs `user.me`). */
function BotAccountPlaceholder() {
  return (
    <SectionPlaceholder name="bot-account">
      <PlaceholderCard
        title="Bot account"
        description="The Twitch account that talks in your chat"
        action={<ChipSkeleton className="h-7 w-26" />}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <Skeleton className="h-7 w-27 shrink-0" />
        </div>
        <TextLines lines={2} lineClassName="h-4.75" />
      </PlaceholderCard>
    </SectionPlaceholder>
  );
}

/** Overview → Run the bot (needs `user.me`; its own URL query then shows the same body). */
function BotConsolePlaceholder() {
  return (
    <SectionPlaceholder name="bot-console">
      <PlaceholderCard
        title="Run the bot"
        action={<ChipSkeleton className="h-7 w-24" />}
        description={
          <>
            The bot runs inside a browser page. Its URL is a secret: treat it like a stream key.
            <span className="mt-1 block font-medium text-foreground">
              Runs only while the bot page is open in OBS or a browser tab.
            </span>
          </>
        }
      >
        <BotConsoleBodySkeleton />
      </PlaceholderCard>
    </SectionPlaceholder>
  );
}

/**
 * The whole Overview while `user.me` streams: whether a bot account exists decides the
 * order of its cards, so this takes the connected arrangement (the steady state; the first
 * run puts the account card on top instead).
 */
export function BotOverviewPlaceholder() {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6">
        <LiveControlsPlaceholder />
        <BotAccountPlaceholder />
      </div>
      <BotConsolePlaceholder />
    </div>
  );
}

/** A Commands page group card: its switch and on/off copy are data, its table is static. */
function CommandGroupPlaceholder({ title, rows }: { title: string; rows: typeof taskCommands }) {
  return (
    <PlaceholderCard
      title={title}
      description={<Skeleton className="h-4 my-0.5 w-full max-w-90" />}
      action={<Skeleton className="h-4.6 w-8 rounded-full" />}
      contentClassName=""
    >
      <CommandTable caption={title} commands={rows} aliases={null} />
    </PlaceholderCard>
  );
}

/** Commands (needs `config.get`): both group cards, the always-on table, the alias editor. */
export function CommandsPlaceholder() {
  return (
    <SectionPlaceholder name="commands">
      <div className="space-y-6">
        <CommandGroupPlaceholder
          title="Task commands"
          rows={taskCommands.filter((row) => !row.alwaysOn)}
        />
        <CommandGroupPlaceholder
          title="Timer commands"
          rows={timerCommands.filter((row) => !row.alwaysOn)}
        />
        <PlaceholderCard
          title="Always on"
          description="Help for viewers. These answer even while Task commands are off."
          contentClassName=""
        >
          <CommandTable caption="Always-on commands" commands={metaCommands} aliases={null} />
        </PlaceholderCard>
        <PlaceholderCard
          title="Aliases"
          description={
            <>
              Extra names for a command, like <code className="font-mono">!t</code> for{" "}
              <code className="font-mono">!task</code>. They show in the tables above as you type.
              To change what a command says, see{" "}
              <span className="font-medium text-link">Replies</span>.
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-full max-w-80 min-w-0">
                <TextLines lines={1} />
                <TextLines lines={1} narrow={2} lineClassName="h-4" />
              </div>
              <Skeleton className="h-7 w-24 shrink-0" />
            </div>
            {/* The alias rows; sized like the editor with none (its empty-state line). */}
            <Skeleton className="h-12 w-full" />
          </div>
          <p className="text-xs text-muted-foreground">
            An open bot page picks up new aliases within an hour, or right away when you reload it.
          </p>
        </PlaceholderCard>
      </div>
    </SectionPlaceholder>
  );
}

/**
 * Replies (needs `config.get` + `user.me`): the Task / Timer switcher, then the Task set as it
 * opens: the filter row and every reply group, collapsed.
 */
export function RepliesPlaceholder() {
  const groups = [...new Set(taskMessageFields.map((field) => field.group))];
  return (
    <SectionPlaceholder name="replies">
      <PlaceholderCard
        title="Replies"
        description="What the bot says after each command. Each group names the commands that send it."
        contentClassName=""
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <div className="space-y-5 pt-4">
            <Skeleton className="h-9 w-full md:h-8" />
            {groups.map((group) => (
              <Skeleton
                key={group}
                // A group with a long command list wraps it onto a second line when narrow.
                className={`h-10.5 w-full rounded-xl ${group === "Editing & removing" ? "max-sm:h-15.25" : ""}`}
              />
            ))}
          </div>
        </div>
      </PlaceholderCard>
    </SectionPlaceholder>
  );
}

/** Moderation → Blocked viewers (needs `config.get`): the form, then the (empty) list. */
export function BlockedViewersPlaceholder() {
  return (
    <SectionPlaceholder name="blocked-viewers">
      <PlaceholderCard
        title="Blocked viewers"
        description="The bot ignores their commands. Blocking also removes every task they added."
        contentClassName="space-y-5"
      >
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 md:h-8" />
            <Skeleton className="h-9 w-27 md:h-8" />
          </div>
        </div>
        <div className="space-y-2 border-t border-border/40 pt-4">
          <div className="flex h-5 items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-18" />
            <Skeleton className="h-3 w-12" />
          </div>
          <TextLines lines={1} narrow={2} />
        </div>
      </PlaceholderCard>
    </SectionPlaceholder>
  );
}

function PanelSkeleton() {
  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <BotConsoleBodySkeleton />
      </CardContent>
    </Card>
  );
}

/** Static, data-free skeleton of a Bot settings page body (client navigation only). */
export function BotSettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton />
    </div>
  );
}
