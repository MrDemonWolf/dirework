"use client";

import { Info } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Variable {
  name: string;
  usedIn: string;
  description: string;
}

const taskVariables: Variable[] = [
  { name: "{user}", usedIn: "Most messages", description: "The Twitch display name of the person who ran the command" },
  { name: "{user2}", usedIn: "taskCheckUser", description: "The Twitch display name of the target user when checking someone else's task" },
  { name: "{task}", usedIn: "taskAdded, taskEdited, taskRemoved, taskDone, taskCheck, taskCheckUser", description: "The task text content" },
  { name: "{oldTask}", usedIn: "taskNext", description: "The task text that was just completed when moving to the next task" },
  { name: "{newTask}", usedIn: "taskNext", description: "The new task text now being tracked after completing the previous one" },
];

const timerVariables: Variable[] = [
  { name: "{channel}", usedIn: "workRemindMsg", description: "The Twitch channel name, used as @mention to ping chat" },
  { name: "{time}", usedIn: "eta", description: "The estimated end time formatted as local clock time (e.g., 3:45 PM)" },
];

function VariableTable({ variables }: { variables: Variable[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-1.5 text-left font-medium">Variable</th>
            <th className="px-3 py-1.5 text-left font-medium">Used In</th>
            <th className="px-3 py-1.5 text-left font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v) => (
            <tr key={v.name} className="border-b last:border-0">
              <td className="px-3 py-1.5 font-mono text-primary">{v.name}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{v.usedIn}</td>
              <td className="px-3 py-1.5">{v.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaskVariableReference() {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Info className="size-3.5" />
        Available variables
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          <VariableTable variables={taskVariables} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TimerVariableReference() {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Info className="size-3.5" />
        Available variables
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          <VariableTable variables={timerVariables} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
