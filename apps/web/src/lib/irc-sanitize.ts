import { hasControlCharacters, replaceControlCharacters } from "@dirework/api/config-shared";

interface IrcCredentialFields {
  botUsername: string;
  channelName: string;
  chatToken: string;
}

const TWITCH_LOGIN_PATTERN = /^[a-z0-9_]{1,25}$/i;

/** Ensure no credential can break out of the raw PASS, NICK, or JOIN frame. */
export function hasSafeIrcCredentials(credentials: IrcCredentialFields): boolean {
  return (
    TWITCH_LOGIN_PATTERN.test(credentials.botUsername) &&
    TWITCH_LOGIN_PATTERN.test(credentials.channelName) &&
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
