// Blocking theme bootstrap, inlined in the root layout's <head> (app/layout.tsx).
//
// next-themes injects its own script as the first child of <body>. With streaming SSR the
// <head> stylesheets can paint before the body chunk arrives, over a white canvas and the
// light `:root` palette, so a hard reload of a dark page flashed white. This runs before
// first paint instead: it sets the theme class and `color-scheme` on <html>, and
// next-themes then finds them already correct on hydration.
//
// Keep it in sync with components/providers.tsx: `defaultTheme="dark"`, `enableSystem`,
// and next-themes' default storageKey ("theme"). A missing or unknown stored value
// resolves to dark, exactly as next-themes does with defaultTheme="dark".
//
// A plain string (not fn.toString()) so a minifier or the React Compiler can never rewrite
// it into something that no longer runs standalone.

/** next-themes' localStorage key (its default; providers.tsx sets no custom storageKey). */
export const THEME_STORAGE_KEY = "theme";

/** Inline script body: resolves the stored theme and applies it to <html> before paint. */
export const THEME_INIT_SCRIPT =
  '(function(){var d=document.documentElement;var t=true;try{var s=localStorage.getItem("theme");if(s==="light")t=false;else if(s==="system")t=matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){}var c=d.classList;c.remove("light","dark");c.add(t?"dark":"light");d.style.colorScheme=t?"dark":"light";})();';
