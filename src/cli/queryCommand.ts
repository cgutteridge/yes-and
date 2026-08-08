import type { z } from "zod";
import { loadConfig } from "../config/env.js";
import { exampleSchemas } from "../schemas/exampleSchemas.js";
import { createAiClient } from "../services/aiClient.js";
import { runJsonQuery } from "../services/jsonQueryService.js";
import { logger } from "../utils/logger.js";

export interface QueryCommandOptions {
  schema: string;
  maxAttempts: number;
}

/**
 * The original generic-CLI behavior, unchanged, extracted out of index.ts.
 * Known errors (ConfigError/JsonQueryError/APIError) are left to propagate
 * -- runCommand (the caller) is responsible for catching and logging them.
 */
export async function runQueryCommand(prompt: string, options: QueryCommandOptions): Promise<void> {
  const schema: z.ZodType<unknown> | undefined =
    exampleSchemas[options.schema as keyof typeof exampleSchemas];
  if (!schema) {
    logger.error(
      `unknown schema "${options.schema}". Available: ${Object.keys(exampleSchemas).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const client = createAiClient(config);
  const result = await runJsonQuery(client, schema, prompt, {
    model: config.model,
    maxAttempts: options.maxAttempts,
    operation: `query:${options.schema}`,
    aiLogPath: config.aiLogPath,
  });
  console.log(JSON.stringify(result, null, 2));
}
