export interface SignInError {
  title: string;
  hint: string;
  /**
   * Link text that points the visitor at the deploy guide. Only the claimed-instance
   * refusal has one: whoever sees it is almost always a streamer who wants their own copy.
   */
  cta?: string;
}

/** Copy for the `?error=` codes better-auth appends to the sign-in redirect. */
export const SIGN_IN_ERRORS = {
  instance_claimed: {
    title: "This DireWork already belongs to a different Twitch account.",
    hint: "If this is your channel, sign in with the Twitch account that claimed it.",
    cta: "This DireWork belongs to another streamer. Deploy your own →",
  },
  // Bot-account OAuth (/api/bot/authorize) bounces here when the request has
  // no streamer session — usually an expired session or a bookmarked link.
  not_authenticated: {
    title: "Sign in before connecting a bot account.",
    hint: "Your DireWork session has ended. Sign in with Twitch as the streamer, then connect the bot again from the Bot page.",
  },
  // …or when the signed-in account isn't this instance's owner.
  not_owner: {
    title: "Only this DireWork's owner can connect a bot account.",
    hint: "You're signed in with a Twitch account that doesn't own this DireWork. Sign out, sign in as the streamer who claimed it, then try again.",
  },
  signin_failed: {
    title: "Twitch sign-in didn't complete.",
    hint: "Nothing was changed. Try the button again. If it keeps failing, check that the Twitch app's redirect URL matches this site.",
  },
} satisfies Record<string, SignInError>;

/** Map a redirect error code (any case) to its copy; unknown codes are a generic failure. */
export function resolveSignInError(code: string): SignInError {
  const key = code.trim().toLowerCase();
  return Object.hasOwn(SIGN_IN_ERRORS, key)
    ? SIGN_IN_ERRORS[key as keyof typeof SIGN_IN_ERRORS]
    : SIGN_IN_ERRORS.signin_failed;
}
