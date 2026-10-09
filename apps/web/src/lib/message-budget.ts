import { MAX_MESSAGE_TEMPLATE_BYTES, utf8ByteLength } from "@dirework/api/config-shared";

/** Show the byte counter from this share of the budget so it stays out of the way until it matters. */
const SHOW_FROM = 0.8;

export interface MessageBudget {
  bytes: number;
  max: number;
  /** Close enough to the cap that the counter should be visible. */
  nearLimit: boolean;
  /** Over the cap — the server would reject the save. */
  over: boolean;
}

/** UTF-8 byte budget of a stored chat template — the unit the server validates in, not characters. */
export function messageBudget(value: string): MessageBudget {
  const bytes = utf8ByteLength(value);
  return {
    bytes,
    max: MAX_MESSAGE_TEMPLATE_BYTES,
    nearLimit: bytes >= MAX_MESSAGE_TEMPLATE_BYTES * SHOW_FROM,
    over: bytes > MAX_MESSAGE_TEMPLATE_BYTES,
  };
}
