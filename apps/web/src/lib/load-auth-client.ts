// Click-time loader for the better-auth client (lib/auth-client.ts). The client runs only
// when someone signs in or out, so the header and the sign-in buttons import it on the click
// instead of shipping it (~12 KiB gz) in every (app) page's first load.
//
// Deploy skew: this deploys several times a day, and a tab opened before a deploy asks for
// the chunk under its old hash, which the new deploy no longer serves. When the import fails
// the page reloads, so the next click runs the current build instead of doing nothing.

type AuthClientModule = typeof import("@/lib/auth-client");

/** The auth client module, or `null` after a failed chunk load (the page is reloading). */
export async function loadAuthClient(): Promise<AuthClientModule | null> {
  try {
    return await import("@/lib/auth-client");
  } catch {
    location.reload();
    return null;
  }
}
