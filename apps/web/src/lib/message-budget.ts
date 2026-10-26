import { MAX_MESSAGE_TEMPLATE_BYTES, utf8ByteLength } from "@dirework/api/config-shared";
import { graphemeLength } from "@dirework/api/chat-text";
import { PHASE_LABEL_MAX_BYTES, PHASE_LABEL_MAX_GRAPHEMES } from "@dirework/api/style-limits";

/** Show a counter from this share of its cap so it stays out of the way until it matters. */
const SHOW_FROM = 0.8;

export interface MessageBudget {
  /** How much of the cap the value uses, in `unit`. */
  used: number;
  max: number;
  unit: "bytes" | "characters";
  /** Close enough to the cap that the counter should be visible. */
  nearLimit: boolean;
  /** Over the cap — the server would reject the save. */
  over: boolean;
}

function budget(used: number, max: number, unit: MessageBudget["unit"]): MessageBudget {
  return { used, max, unit, nearLimit: used >= max * SHOW_FROM, over: used > max };
}

/** UTF-8 byte budget of a stored chat template — the unit the server validates in, not characters. */
export function messageBudget(value: string): MessageBudget {
  return budget(utf8ByteLength(value), MAX_MESSAGE_TEMPLATE_BYTES, "bytes");
}

/**
 * A phase label's budget: PHASE_LABEL_MAX_GRAPHEMES user-perceived characters and
 * PHASE_LABEL_MAX_BYTES bytes, the server's two caps. Shows whichever is closer to its cap
 * (characters on a tie), so the counter names the limit that will stop the owner.
 */
export function phaseLabelBudget(value: string): MessageBudget {
  const characters = budget(graphemeLength(value), PHASE_LABEL_MAX_GRAPHEMES, "characters");
  const bytes = budget(utf8ByteLength(value), PHASE_LABEL_MAX_BYTES, "bytes");
  return bytes.used / bytes.max > characters.used / characters.max ? bytes : characters;
}
