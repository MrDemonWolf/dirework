import { TWITCH_LOGIN_PATTERN } from "@dirework/api/chat-commands";
import { hasControlCharacters, replaceControlCharacters } from "@dirework/api/chat-text";

interface IrcCredentialFields {
  botUsername: string;
  channelName: string;
  chatToken: string;
}

/**
 * The shared Twitch login rule, case-insensitive: IRC credentials arrive display-cased. Test
 * the raw value against this copy, never a lowercased one: U+212A KELVIN SIGN lowercases to
 * an ASCII "k", so lowercase-then-test would pass a non-ASCII login into the NICK frame.
 */
const IRC_LOGIN_PATTERN = new RegExp(TWITCH_LOGIN_PATTERN.source, "i");

/** Ensure no credential can break out of the raw PASS, NICK, or JOIN frame. */
export function hasSafeIrcCredentials(credentials: IrcCredentialFields): boolean {
  return (
    IRC_LOGIN_PATTERN.test(credentials.botUsername) &&
    IRC_LOGIN_PATTERN.test(credentials.channelName) &&
    credentials.chatToken.length > 0 &&
    credentials.chatToken.length <= 4096 &&
    !hasControlCharacters(credentials.chatToken)
  );
}

// IRC frames are CRLF-delimited. Stored response templates are owner-controlled,
// so sanitize again at the protocol boundary to prevent an accidental newline or
// control byte from becoming a second IRC command.
export function sanitizeIrcMessage(text: string): string {
  return replaceControlCharacters(text).replace(/\s+/gu, " ").trim();
}
