const isDebugEnabled = (): boolean => process.env.DEBUG === "1" || process.env.DEBUG === "true";

/**
 * All levels write to stderr so stdout stays reserved for a command's actual
 * data output (e.g. the validated JSON result), safe to pipe.
 */
export const logger = {
  info(message: string): void {
    console.error(message);
  },
  debug(message: string): void {
    if (isDebugEnabled()) {
      console.error(`[debug] ${message}`);
    }
  },
  error(message: string): void {
    console.error(`Error: ${message}`);
  },
};
