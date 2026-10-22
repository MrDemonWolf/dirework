"use client";

// Moderation card on the bot settings page: the mod-only chat commands beside the viewer
// block list. Blocking and unblocking save immediately (no Save bar) through the same
// services the !block / !unblock chat commands use, so the list here and in chat is one list.

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MAX_BLOCKED_VIEWERS, normalizeTwitchLogin } from "@dirework/api/chat-commands";

import { formatMutationError } from "@/lib/validation-errors";
import { CommandReference } from "@/components/bot-settings/command-reference";
import { moderationCommands } from "@/lib/command-rows";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { CountBadge } from "@/components/count-badge";
import { SectionGroup } from "@/components/section-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

/** The card's anchor id, for the Bot settings page's "Moderation" jump link. */
export const MODERATION_CARD_ID = "moderation";

/**
 * `blockedViewers` is the live `config.get` list (lowercase logins), not a draft. Blocking
 * confirms first (it deletes the viewer's tasks); Enter in the username field opens the same
 * dialog. Unblocking is one click: it only restores their commands.
 */
export function BlockedViewersCard({ blockedViewers }: { blockedViewers: string[] }) {
  const queryClient = useQueryClient();
  const listId = useId();
  const hintId = useId();
  const [input, setInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });

  const blockViewer = useMutation({
    ...trpc.config.blockViewer.mutationOptions(),
    onSuccess: ({ login }) => {
      setInput("");
      toast.success(`Blocked ${login}`);
      return refresh();
    },
    onError: (err) => {
      toast.error(`Couldn't block that viewer: ${formatMutationError(err)}`);
    },
  });

  const unblockViewer = useMutation({
    ...trpc.config.unblockViewer.mutationOptions(),
    onSuccess: ({ login }) => {
      toast.success(`Unblocked ${login}`);
      return refresh();
    },
    onError: (err) => {
      toast.error(`Couldn't unblock that viewer: ${formatMutationError(err)}`);
    },
  });

  // Same normalizer as the server schema and !block, so the button only enables for a
  // login the server will accept, and the dialog names exactly what gets stored.
  const login = normalizeTwitchLogin(input);
  const full = blockedViewers.length >= MAX_BLOCKED_VIEWERS;
  const hint = full
    ? "Block list is full"
    : input.trim() && !login
      ? "Letters, numbers and underscores only"
      : null;

  return (
    <Card id={MODERATION_CARD_ID} className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <ConsoleRule label="Chat safety" />
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          Moderation
        </CardTitle>
        <CardDescription>
          Mods can run these from chat; you can also manage them here
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <CommandReference commands={moderationCommands} className="order-last lg:order-first" />

          <SectionGroup
            title="Blocked viewers"
            titleId={listId}
            trailing={<CountBadge count={blockedViewers.length} />}
          >
            {blockedViewers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked viewers.</p>
            ) : (
              <ul aria-labelledby={listId} className="divide-y divide-border/40">
                {blockedViewers.map((viewer) => (
                  <li key={viewer} className="flex items-center justify-between gap-2 py-1.5">
                    <code className="truncate font-mono text-sm">{viewer}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={unblockViewer.isPending}
                      onClick={() => unblockViewer.mutate({ login: viewer })}
                      aria-label={`Unblock ${viewer}`}
                    >
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* A form, so Enter in the field opens the confirm like the button does. */}
            <form
              className="space-y-1.5 border-t border-border/40 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (login && !full && !blockViewer.isPending) setConfirmOpen(true);
              }}
            >
              <Label htmlFor="block-viewer-login">Twitch username</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="block-viewer-login"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="@username"
                  maxLength={26}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={(hint !== null && !full) || undefined}
                  aria-describedby={hint ? hintId : undefined}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!login || full || blockViewer.isPending}
                >
                  Block viewer
                </Button>
                <ConfirmDialog
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title={`Block ${login ?? ""}?`}
                  description="Their chat commands are ignored and every task they added is removed from the board. Unblocking later restores commands, not tasks."
                  confirmLabel="Block"
                  onConfirm={() => {
                    if (login) blockViewer.mutate({ login });
                  }}
                />
              </div>
              {hint && (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {hint}
                </p>
              )}
            </form>
          </SectionGroup>
        </div>
      </CardContent>
    </Card>
  );
}
