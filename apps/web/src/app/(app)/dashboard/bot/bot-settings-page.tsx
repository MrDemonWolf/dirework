"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import type { MessagesConfig, CommandAliasesConfig } from "@/lib/config-types";
import { deepMerge } from "@/lib/deep-merge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MessageEditor } from "@/components/bot-settings/message-editor";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { trpc } from "@/utils/trpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const defaultMessages: MessagesConfig = {
  taskAdded: "@{user}, task added!",
  taskDone: "@{user}, task marked done!",
  taskEdited: "@{user}, task updated!",
  taskRemoved: "@{user}, task removed!",
  noTasks: "@{user}, you have no tasks.",
  timerStarted: "Timer started! {duration} minutes",
  timerPaused: "Timer paused.",
  timerResumed: "Timer resumed!",
};

const defaultCommandAliases: CommandAliasesConfig = {};

export default function BotSettingsPage() {
  const queryClient = useQueryClient();
  const config = useQuery(trpc.config.get.queryOptions());

  // Working state
  const [messages, setMessages] = useState<MessagesConfig>(defaultMessages);
  const [commandAliases, setCommandAliases] =
    useState<CommandAliasesConfig>(defaultCommandAliases);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Saved state
  const [savedMessages, setSavedMessages] =
    useState<MessagesConfig>(defaultMessages);
  const [savedCommandAliases, setSavedCommandAliases] =
    useState<CommandAliasesConfig>(defaultCommandAliases);

  // Once config loads, merge saved values with defaults
  useEffect(() => {
    if (config.data) {
      const configData = config.data as AnyRecord;
      const mergedMessages = deepMerge(
        defaultMessages,
        (configData.messages as AnyRecord) ?? {},
      ) as unknown as MessagesConfig;
      const mergedAliases = (configData.commandAliases ??
        {}) as CommandAliasesConfig;

      setMessages(mergedMessages);
      setCommandAliases(mergedAliases);
      setSavedMessages(mergedMessages);
      setSavedCommandAliases(mergedAliases);
    }
  }, [config.data]);

  const updateMessagesMutation = useMutation({
    ...trpc.config.updateMessages.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  const updateAliasesMutation = useMutation({
    ...trpc.config.updateCommandAliases.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  const isSaving =
    updateMessagesMutation.isPending || updateAliasesMutation.isPending;

  const handleMessagesChange = useCallback((newMessages: MessagesConfig) => {
    setMessages(newMessages);
    setHasUnsaved(true);
  }, []);

  const handleAliasesChange = useCallback(
    (newAliases: CommandAliasesConfig) => {
      setCommandAliases(newAliases);
      setHasUnsaved(true);
    },
    [],
  );

  const handleReset = useCallback(() => {
    setMessages(savedMessages);
    setCommandAliases(savedCommandAliases);
    setHasUnsaved(false);
  }, [savedMessages, savedCommandAliases]);

  const handleSave = useCallback(async () => {
    try {
      await updateMessagesMutation.mutateAsync({
        messages: messages as unknown as AnyRecord,
      });
      await updateAliasesMutation.mutateAsync({
        commandAliases: commandAliases,
      });
      setSavedMessages(messages);
      setSavedCommandAliases(commandAliases);
      setHasUnsaved(false);
      toast.success("Bot settings saved successfully");
    } catch {
      toast.error("Failed to save bot settings");
    }
  }, [messages, commandAliases, updateMessagesMutation, updateAliasesMutation]);

  if (config.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bot Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure bot response messages and command aliases
        </p>
      </div>

      <div className="space-y-6">
        <MessageEditor messages={messages} onChange={handleMessagesChange} />

        <Separator />

        <CommandAliasEditor
          aliases={commandAliases}
          onChange={handleAliasesChange}
        />
      </div>

      {/* Save / Reset Bar */}
      <Separator className="my-6" />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={!hasUnsaved || isSaving}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          Reset
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasUnsaved || isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-3.5" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
