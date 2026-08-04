import { APIError } from "openai";
import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { ConfigError, loadConfig } from "./config/env.js";
import { createAiClient } from "./services/aiClient.js";
import { JsonQueryError, runJsonQuery } from "./services/jsonQueryService.js";
import { exampleSchemas } from "./schemas/exampleSchemas.js";
import { logger } from "./utils/logger.js";

loadDotenv({ quiet: true });

interface QueryOptions {
  schema: string;
  maxAttempts: number;
}

const program = new Command();

program
  .name("yesand")
  .description("Query an OpenAI-compatible AI API and validate the JSON response against a schema")
  .argument("<prompt>", "prompt to send to the model")
  .option(
    "-s, --schema <name>",
    `example schema to validate against (${Object.keys(exampleSchemas).join(", ")})`,
    "summary",
  )
  .option(
    "--max-attempts <count>",
    "retry attempts on schema validation failure",
    (value: string) => Number.parseInt(value, 10),
    2,
  )
  .action(async (prompt: string, options: QueryOptions) => {
    const schema: z.ZodType<unknown> | undefined =
      exampleSchemas[options.schema as keyof typeof exampleSchemas];
    if (!schema) {
      logger.error(
        `unknown schema "${options.schema}". Available: ${Object.keys(exampleSchemas).join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }

    try {
      const config = loadConfig();
      const client = createAiClient(config);
      const result = await runJsonQuery(client, schema, prompt, {
        model: config.model,
        maxAttempts: options.maxAttempts,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (
        error instanceof ConfigError ||
        error instanceof JsonQueryError ||
        error instanceof APIError
      ) {
        logger.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  });

await program.parseAsync(process.argv);
