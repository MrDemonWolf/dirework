export interface SignInError {
  title: string;
  hint: string;
}

/** Copy for the `?error=` codes better-auth appends to the sign-in redirect. */
export const SIGN_IN_ERRORS = {
  instance_claimed: {
    title: "This Dirework already belongs to a different Twitch account.",
    hint: "Each Dirework belongs to one streamer. Sign in with the account that claimed it, or deploy your own copy.",
  },
  // Bot-account OAuth (/api/bot/authorize) bounces here when the request has
  // no streamer session — usually an expired session or a bookmarked link.
  not_authenticated: {
    title: "Sign in before connecting a bot account.",
    hint: "Your Dirework session has ended. Sign in with Twitch as the streamer, then connect the bot again from the Bot page.",
  },
  // …or when the signed-in account isn't this instance's owner.
  not_owner: {
    title: "Only this Dirework's owner can connect a bot account.",
    hint: "You're signed in with a Twitch account that doesn't own this Dirework. Sign out, sign in as the streamer who claimed it, then try again.",
  },
  signin_failed: {
    title: "Twitch sign-in didn't complete.",
    hint: "Nothing was changed — try the button again. If it keeps failing, check that the Twitch app's redirect URL matches this site.",
  },
} satisfies Record<string, SignInError>;

/** Map a redirect error code (any case) to its copy; unknown codes are a generic failure. */
export function resolveSignInError(code: string): SignInError {
  const key = code.trim().toLowerCase();
  return Object.hasOwn(SIGN_IN_ERRORS, key)
    ? SIGN_IN_ERRORS[key as keyof typeof SIGN_IN_ERRORS]
    : SIGN_IN_ERRORS.signin_failed;
}
