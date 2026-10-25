"use client";

// The Blocked viewers card on the Bot settings Moderation page: block a viewer, and the block
// list. Blocking and unblocking save immediately (no Save bar) through the same services
// the !block / !unblock chat commands use, so the list here and in chat is one list.

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { MAX_BLOCKED_VIEWERS, normalizeTwitchLogin } from "@dirework/api/chat-commands";

import { formatMutationError } from "@/lib/validation-errors";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

/** Past this many names the list gets a filter field. */
export const BLOCKED_FILTER_THRESHOLD = 8;

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
  const [filter, setFilter] = useState("");
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
    ? "Block list is full. Unblock someone first."
    : input.trim() && !login
      ? "Letters, numbers and underscores only"
      : null;

  const showFilter = blockedViewers.length > BLOCKED_FILTER_THRESHOLD;
  const needle = filter.trim().replace(/^@/, "").toLowerCase();
  const shown =
    showFilter && needle ? blockedViewers.filter((v) => v.includes(needle)) : blockedViewers;

  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          Blocked viewers
        </CardTitle>
        <CardDescription>
          The bot ignores their commands. Blocking also removes every task they added.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        {/* A form, so Enter in the field opens the confirm like the button does. */}
        <form
          className="space-y-1.5"
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

        <section aria-labelledby={listId} className="space-y-2 border-t border-border/40 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id={listId} className="text-sm font-medium">
              Block list
            </h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              {blockedViewers.length} of {MAX_BLOCKED_VIEWERS}
            </p>
          </div>

          {showFilter && (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter blocked viewers"
                aria-label="Filter blocked viewers"
                autoComplete="off"
                spellCheck={false}
                className="pl-8"
              />
            </div>
          )}

          {blockedViewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No blocked viewers. Block someone above, or have a mod send{" "}
              <code className="font-mono text-foreground">!block @user</code> in chat.
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked viewer matches “{filter}”.</p>
          ) : (
            <ul aria-labelledby={listId} className="divide-y divide-border/40">
              {shown.map((viewer) => (
                <li key={viewer} className="flex items-center justify-between gap-2 py-1">
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
        </section>
      </CardContent>
    </Card>
  );
}
