/**
 * Defensive parsers for everything the bot OAuth flow (`routes/bot-oauth.ts`) reads from
 * outside: the callback query params, our own round-tripped `state`, and Twitch's token and
 * Helix user responses. Each returns null on any malformed input instead of throwing, so the
 * route can map it to a fixed error redirect.
 */

/** The subset of Twitch's `/oauth2/token` response Dirework persists for the bot account. */
export interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
}

/** The bot account's identity, from the first entry of Helix `GET /users`. */
export interface TwitchHelixUser {
  id: string;
  login: string;
  display_name: string;
}

/**
 * Decoded `state` param: the signed-in owner's user id plus the CSRF nonce that must match the
 * httpOnly nonce cookie set by `/api/bot/authorize`.
 */
export interface BotOAuthState {
  userId: string;
  nonce: string;
}

// Upper bounds on attacker-controlled query params, checked before any decoding work.
const MAX_OAUTH_CODE_LENGTH = 4096;
const MAX_OAUTH_STATE_LENGTH = 1024;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Non-empty string within `max` UTF-16 units and free of C0/DEL control characters. */
function boundedString(value: unknown, max: number): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) return false;
  }
  return true;
}

/**
 * Require both `code` and `state` on the callback and cap their lengths. Returns null when
 * either is missing or oversized. Only the length is checked here; the route decodes and
 * verifies `state` separately via `parseBotOAuthState`.
 */
export function parseOAuthCallbackParams(
  code: string | undefined,
  state: string | undefined,
): { code: string; state: string } | null {
  if (
    !code ||
    code.length > MAX_OAUTH_CODE_LENGTH ||
    !state ||
    state.length > MAX_OAUTH_STATE_LENGTH
  ) {
    return null;
  }
  return { code, state };
}

/** Decode a bounded OAuth state payload and require the exact nonce shape we issue. */
export function parseBotOAuthState(state: string): BotOAuthState | null {
  if (!state || state.length > MAX_OAUTH_STATE_LENGTH) return null;
  try {
    // `state` is unpadded base64url (see `encodeState` in bot-oauth.ts): restore the
    // standard alphabet and padding before atob, then decode the bytes as UTF-8.
    const base64 =
      state.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (state.length % 4)) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = record(JSON.parse(new TextDecoder().decode(bytes)));
    if (!decoded) return null;
    if (!boundedString(decoded.userId, 128)) return null;
    // 32 random bytes, hex-encoded (`randomNonce` in bot-oauth.ts).
    if (typeof decoded.nonce !== "string" || !/^[a-f0-9]{64}$/.test(decoded.nonce)) return null;
    return { userId: decoded.userId, nonce: decoded.nonce };
  } catch {
    return null;
  }
}

/** Parse only the Twitch token fields Dirework persists; reject malformed upstream JSON. */
export function parseTwitchTokenResponse(value: unknown): TwitchTokenResponse | null {
  const input = record(value);
  if (!input) return null;
  if (!boundedString(input.access_token, 4096) || !boundedString(input.refresh_token, 4096)) {
    return null;
  }
  if (
    typeof input.expires_in !== "number" ||
    !Number.isInteger(input.expires_in) ||
    input.expires_in < 1 ||
    // Sanity ceiling (one year in seconds); anything larger is not a real Twitch expiry.
    input.expires_in > 366 * 24 * 60 * 60
  ) {
    return null;
  }
  if (!boundedString(input.token_type, 32) || input.token_type.toLowerCase() !== "bearer")
    return null;

  let scope: string[] | undefined;
  if (input.scope !== undefined) {
    if (
      !Array.isArray(input.scope) ||
      input.scope.length > 32 ||
      !input.scope.every((item) => boundedString(item, 128))
    ) {
      return null;
    }
    scope = input.scope;
  }

  return {
    access_token: input.access_token,
    refresh_token: input.refresh_token,
    expires_in: input.expires_in,
    token_type: input.token_type,
    ...(scope ? { scope } : {}),
  };
}

/** Extract and validate the first Helix user returned for the bot token. */
export function parseTwitchHelixUser(value: unknown): TwitchHelixUser | null {
  const input = record(value);
  if (!input || !Array.isArray(input.data)) return null;
  const user = record(input.data[0]);
  if (!user) return null;
  if (typeof user.id !== "string" || !/^\d{1,32}$/.test(user.id)) return null;
  if (typeof user.login !== "string" || !/^[a-z0-9_]{1,25}$/i.test(user.login)) return null;
  if (!boundedString(user.display_name, 64)) return null;
  return { id: user.id, login: user.login, display_name: user.display_name };
}

/**
 * True for the error an `AbortSignal.timeout` produces on a Twitch fetch, so the route can
 * record it as `upstream.timeout` rather than a generic OAuth failure.
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
