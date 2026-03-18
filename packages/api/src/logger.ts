/** Lightweight structured logger — thin wrapper over console for consistent formatting. */
export const logger = {
  info(message: string, ...args: unknown[]) {
    console.log(message, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(message, ...args);
  },
  error(message: string, ...args: unknown[]) {
    console.error(message, ...args);
  },
};
