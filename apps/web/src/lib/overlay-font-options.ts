/**
 * Overlay/Theme-Center font choices — single source for the picker, the
 * font-fetch script (apps/web/scripts/fetch-fonts.ts), and the drift test.
 * Every family here is self-hosted under public/fonts (OFL/Apache licensed);
 * adding one means re-running `bun run fetch-fonts`.
 */
export const FONT_OPTIONS = [
  "Montserrat",
  "Roboto",
  "Inter",
  "Poppins",
  "Open Sans",
  "Lato",
  "Nunito",
  "Oswald",
  "Raleway",
  "Source Sans 3",
  "Ubuntu",
  "Merriweather",
  "Playfair Display",
  "Space Grotesk",
  "DM Sans",
  "Lexend",
  "Share Tech Mono",
  "Fira Code",
  "JetBrains Mono",
  "Fredoka One",
] as const;
