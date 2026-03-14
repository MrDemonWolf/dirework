"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { CommandAliasesConfig } from "@/lib/config-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const taskCommands = [
  { command: "!task", usage: "!task [task]", description: "Add a task" },
  { command: "!done", usage: "!done or !done [#]", description: "Mark task done" },
  { command: "!edit", usage: "!edit [#] [new task]", description: "Edit a task" },
  { command: "!remove", usage: "!remove [#]", description: "Remove a task" },
  { command: "!focus", usage: "!focus [#]", description: "Set active task" },
  { command: "!check", usage: "!check or !check @user", description: "Check current task" },
  { command: "!next", usage: "!next [task]", description: "Complete & add next task" },
  { command: "!help", usage: "!help", description: "Show help in chat" },
  { command: "!clear", usage: "!clear all/done/@user", description: "Clear tasks (mods only)" },
];

const timerCommands = [
  { command: "!timer start", usage: "!timer start [cycles]", description: "Start timer" },
  { command: "!timer pause", usage: "!timer pause", description: "Pause timer" },
  { command: "!timer resume", usage: "!timer resume", description: "Resume timer" },
  { command: "!timer skip", usage: "!timer skip", description: "Skip current phase" },
  { command: "!timer reset", usage: "!timer reset", description: "Reset to idle" },
  { command: "!timer eta", usage: "!timer eta", description: "Show end time ETA" },
];

const metaCommands = [
  { command: "!dwhelp / !dwcommands", description: "Link to docs or list commands" },
];

interface CommandsReferenceProps {
  aliases: CommandAliasesConfig;
  onAliasesChange: (aliases: CommandAliasesConfig) => void;
}

export function CommandsReference({ aliases, onAliasesChange }: CommandsReferenceProps) {
  const [activeTab, setActiveTab] = useState("commands");

  const entries = Object.entries(aliases);

  const handleAddAlias = () => {
    onAliasesChange({ ...aliases, "": "" });
    setActiveTab("aliases");
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    const newAliases: CommandAliasesConfig = {};
    for (const [k, v] of Object.entries(aliases)) {
      if (k === oldKey) {
        newAliases[newKey] = v;
      } else {
        newAliases[k] = v;
      }
    }
    onAliasesChange(newAliases);
  };

  const handleValueChange = (key: string, value: string) => {
    onAliasesChange({ ...aliases, [key]: value });
  };

  const handleRemove = (key: string) => {
    const newAliases = { ...aliases };
    delete newAliases[key];
    onAliasesChange(newAliases);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Commands Reference</CardTitle>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleAddAlias}>
            <Plus className="size-3.5" />
            <span className="sr-only">Add alias</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="aliases">Aliases</TabsTrigger>
          </TabsList>

          <TabsContent value="commands" className="space-y-5">
            {/* Task Commands */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Task Commands</h3>
              <p className="mb-2 text-xs text-muted-foreground">Requires task commands enabled</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1 font-medium">Command</th>
                    <th className="pb-1 font-medium">Usage</th>
                    <th className="pb-1 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {taskCommands.map((cmd) => (
                    <tr key={cmd.command} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-mono font-medium">{cmd.command}</td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{cmd.usage}</td>
                      <td className="py-1.5 text-muted-foreground">{cmd.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Timer Commands */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Timer Commands</h3>
              <p className="mb-2 text-xs text-muted-foreground">Mods only — requires timer commands enabled</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1 font-medium">Command</th>
                    <th className="pb-1 font-medium">Usage</th>
                    <th className="pb-1 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {timerCommands.map((cmd) => (
                    <tr key={cmd.command} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-mono font-medium">{cmd.command}</td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{cmd.usage}</td>
                      <td className="py-1.5 text-muted-foreground">{cmd.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Meta Commands */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Meta Commands</h3>
              <p className="mb-2 text-xs text-muted-foreground">Always available</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1 font-medium">Command</th>
                    <th className="pb-1 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {metaCommands.map((cmd) => (
                    <tr key={cmd.command} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-mono font-medium">{cmd.command}</td>
                      <td className="py-1.5 text-muted-foreground">{cmd.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="aliases" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Map custom command names to built-in commands. For example, alias &quot;!t&quot; to &quot;!task&quot;.
            </p>
            <div className="space-y-2">
              {entries.map(([key, value], index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`alias-key-${index}`} className="text-xs">Alias</Label>
                    <Input
                      id={`alias-key-${index}`}
                      value={key}
                      onChange={(e) => handleKeyChange(key, e.target.value)}
                      placeholder="!t"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`alias-cmd-${index}`} className="text-xs">Command</Label>
                    <Input
                      id={`alias-cmd-${index}`}
                      value={value}
                      onChange={(e) => handleValueChange(key, e.target.value)}
                      placeholder="!task"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleRemove(key)}
                    aria-label={`Remove alias ${key || "(empty)"}`}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground">No aliases configured. Click + to add one.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
