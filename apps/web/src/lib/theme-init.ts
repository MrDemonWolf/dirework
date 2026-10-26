// Blocking theme bootstrap, inlined in the root layout's <head> (app/layout.tsx).
//
// next-themes injects its own script as the first child of <body>. With streaming SSR the
// <head> stylesheets can paint before the body chunk arrives, over a white canvas and the
// light `:root` palette, so a hard reload of a dark page flashed white. This runs before
// first paint instead: it sets the theme class and `color-scheme` on <html>, and
// next-themes then finds them already correct on hydration.
//
// It mirrors next-themes 0.4's own inline script for our props exactly — keep it in sync
// with components/providers.tsx (`defaultTheme="dark"`, `enableSystem`, the default
// storageKey "theme", `attribute="class"`, default `themes`):
// - a missing or empty stored value resolves to the default, dark;
// - "system" resolves through prefers-color-scheme;
// - any other value is applied as the class verbatim (next-themes does not validate it, so
//   a stale "blue" ends up with neither theme class, i.e. the light palette), and
//   `color-scheme` is only set for "light" / "dark".
//
// It also marks the transparent pages (`data-surface="overlay"` on <html>) before any paint,
// so index.css never paints their canvas: the OBS overlays and the bot page's blank widget
// (`/bot/<token>` without `?view=dock`, read like `parseBotView`). Their layouts'
// transparent overrides live in <body> and arrive after the head has already painted.
//
// A plain string (not fn.toString()) so a minifier or the React Compiler can never rewrite
// it into something that no longer runs standalone.

/** next-themes' localStorage key (its default; providers.tsx sets no custom storageKey). */
export const THEME_STORAGE_KEY = "theme";

/** `data-surface` value the script puts on <html> for /overlay/* and the bot widget. */
export const OVERLAY_SURFACE = "overlay";

/** Inline script body: marks overlays, resolves the stored theme, applies it before paint. */
export const THEME_INIT_SCRIPT =
  '(function(){var d=document.documentElement;try{var p=location.pathname;if(p.indexOf("/overlay/")===0||(p.indexOf("/bot/")===0&&!/^\\s*dock\\s*$/i.test(new URLSearchParams(location.search).get("view")||"")))d.setAttribute("data-surface","overlay");}catch(e){}var t="dark";try{var s=localStorage.getItem("theme");if(s)t=s==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):s;}catch(e){}try{var c=d.classList;c.remove("light","dark");c.add(t);}catch(e){}if(t==="light"||t==="dark")d.style.colorScheme=t;})();';
