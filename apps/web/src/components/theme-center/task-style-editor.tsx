"use client";

// Theme Center editor for the task-list overlay's styles (the "Task style" tab of
// /dashboard/styles).

import type { TaskStylesConfig } from "@/lib/config-types";
import { TASK_STYLE_FIELDS } from "@/lib/style-sections";
import { defaultTaskStyles } from "@/lib/theme-presets";
import { StyleSectionsEditor } from "./style-sections-editor";

/**
 * Controlled form over `TaskStylesConfig`: every edit emits a full new styles object,
 * which the Styles page holds as unsaved working state (driving the live preview)
 * until the owner saves. Rows come from `TASK_STYLE_FIELDS`.
 */
export function TaskStyleEditor({
  styles,
  onChange,
}: {
  styles: TaskStylesConfig;
  onChange: (styles: TaskStylesConfig) => void;
}) {
  return (
    <StyleSectionsEditor
      styles={styles}
      onChange={onChange}
      fields={TASK_STYLE_FIELDS}
      defaults={defaultTaskStyles}
      idPrefix="task-style"
      overlayName="task list"
    />
  );
}
