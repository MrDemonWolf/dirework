"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function CommandsReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Commands Reference</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
      </CardContent>
    </Card>
  );
}
