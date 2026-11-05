"use client";

// Theme Center editor for the timer overlay's styles (the "Timer style" tab of /dashboard/styles).

import type { Dispatch, SetStateAction } from "react";

import type { TimerStylesConfig } from "@/lib/config-types";
import { TIMER_STYLE_FIELDS } from "@/lib/style-sections";
import { defaultTimerStyles } from "@/lib/theme-presets";
import { StyleSectionsEditor } from "./style-sections-editor";

/**
 * Controlled form over `TimerStylesConfig`, which the Styles page holds as unsaved working
 * state (driving the live preview) until the owner saves. `onChange` is that state's
 * setter: every edit is an updater on the current draft. Rows come from `TIMER_STYLE_FIELDS`.
 */
export function TimerStyleEditor({
  styles,
  onChange,
}: {
  styles: TimerStylesConfig;
  onChange: Dispatch<SetStateAction<TimerStylesConfig>>;
}) {
  return (
    <StyleSectionsEditor
      styles={styles}
      onChange={onChange}
      fields={TIMER_STYLE_FIELDS}
      defaults={defaultTimerStyles}
      idPrefix="timer-style"
      overlayName="timer"
    />
  );
}
