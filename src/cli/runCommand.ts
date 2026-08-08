import { APIError } from "openai";
import { ConfigError } from "../config/env.js";
import { ScriptedEntriesExhaustedError } from "../improv/orchestrator.js";
import { SceneConfigError } from "../improv/sceneConfig.js";
import { JsonQueryError } from "../services/jsonQueryService.js";
import { logger } from "../utils/logger.js";

/**
 * Shared error-dispatch wrapper for every CLI command's action: known,
 * expected error types are logged and exit non-zero rather than crashing
 * with a raw stack trace; anything else rethrows. Extracted once a second
 * real command (with its own error types) existed, per this repo's
 * thin-entry-point CLI convention.
 */
export async function runCommand(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (
      error instanceof ConfigError ||
      error instanceof JsonQueryError ||
      error instanceof SceneConfigError ||
      error instanceof ScriptedEntriesExhaustedError ||
      error instanceof APIError
    ) {
      logger.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
