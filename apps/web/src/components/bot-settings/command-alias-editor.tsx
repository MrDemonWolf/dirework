"use client";

import { Plus, Trash2 } from "lucide-react";

import type { CommandAliasesConfig } from "@/lib/config-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionGroup } from "@/components/theme-center/section-group";

export function CommandAliasEditor({
  aliases,
  onChange,
}: {
  aliases: CommandAliasesConfig;
  onChange: (aliases: CommandAliasesConfig) => void;
}) {
  const entries = Object.entries(aliases);

  const handleKeyChange = (oldKey: string, newKey: string) => {
    const newAliases: CommandAliasesConfig = {};
    for (const [k, v] of Object.entries(aliases)) {
      if (k === oldKey) {
        newAliases[newKey] = v;
      } else {
        newAliases[k] = v;
      }
    }
    onChange(newAliases);
  };

  const handleValueChange = (key: string, value: string) => {
    onChange({ ...aliases, [key]: value });
  };

  const handleAdd = () => {
    onChange({ ...aliases, "": "" });
  };

  const handleRemove = (key: string) => {
    const newAliases = { ...aliases };
    delete newAliases[key];
    onChange(newAliases);
  };

  return (
    <SectionGroup title="Command Aliases">
      <p className="text-xs text-muted-foreground">
        Map custom command names to built-in commands. For example, alias
        &quot;!t&quot; to &quot;!task&quot;.
      </p>
      <div className="space-y-2">
        {entries.map(([key, value], index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Alias</Label>
              <Input
                value={key}
                onChange={(e) => handleKeyChange(key, e.target.value)}
                placeholder="!t"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Command</Label>
              <Input
                value={value}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder="!task"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mt-5 shrink-0"
              onClick={() => handleRemove(key)}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-1.5 size-3.5" />
        Add Alias
      </Button>
    </SectionGroup>
  );
}
