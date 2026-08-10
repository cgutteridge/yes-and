import type OpenAI from "openai";
import { z } from "zod";
import { appendAiUsageLog } from "./aiUsageLog.js";
import { logger } from "../utils/logger.js";

export interface JsonQueryOptions {
  model: string;
  maxAttempts?: number;
  operation?: string;
  aiLogPath?: string;
}

export class JsonQueryError extends Error {}

type ParseOutcome<T> = { success: true; data: T } | { success: false; error: string };

export function parseAgainstSchema<T>(content: string, schema: z.ZodType<T>): ParseOutcome<T> {
  let candidate: unknown;
  try {
    candidate = JSON.parse(content);
  } catch (error) {
    return { success: false, error: `response was not valid JSON: ${(error as Error).message}` };
  }

  const result = schema.safeParse(candidate);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  return { success: false, error: issues.join("; ") };
}

function buildSystemPrompt(schema: z.ZodType<unknown>): string {
  const jsonSchema = z.toJSONSchema(schema);
  return [
    "Respond with a single JSON object only.",
    "Do not include prose, explanations, or markdown code fences.",
    "The JSON must conform exactly to this JSON Schema:",
    JSON.stringify(jsonSchema),
  ].join("\n");
}

/**
 * Queries the model for JSON matching `schema`, validating the response and
 * retrying with the validation error fed back to the model on failure.
 */
export async function runJsonQuery<T>(
  client: OpenAI,
  schema: z.ZodType<T>,
  prompt: string,
  options: JsonQueryOptions,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  const operation = options.operation ?? "json-query";
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(schema) },
    { role: "user", content: prompt },
  ];

  let lastError = "no attempts were made";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.debug(`AI query "${operation}" attempt ${attempt}/${maxAttempts}`);

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await client.chat.completions.create({
        model: options.model,
        messages,
        response_format: { type: "json_object" },
      });
    } catch (error) {
      if (options.aiLogPath) {
        await appendAiUsageLog(options.aiLogPath, {
          timestamp: new Date().toISOString(),
          operation,
          model: options.model,
          attempt,
          max_attempts: maxAttempts,
          status: "api_error",
          validation_error: (error as Error).message,
          prompt,
        });
      }
      throw error;
    }

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? "";
    const outcome = parseAgainstSchema(content, schema);

    if (outcome.success) {
      if (options.aiLogPath) {
        await appendAiUsageLog(options.aiLogPath, {
          timestamp: new Date().toISOString(),
          operation,
          model: options.model,
          attempt,
          max_attempts: maxAttempts,
          status: "validated",
          finish_reason: choice?.finish_reason,
          usage: completion.usage,
          prompt,
          response: content,
        });
      }
      return outcome.data;
    }

    lastError = outcome.error;
    logger.debug(
      `AI query "${operation}" attempt ${attempt} failed schema validation: ${lastError}`,
    );
    if (options.aiLogPath) {
      await appendAiUsageLog(options.aiLogPath, {
        timestamp: new Date().toISOString(),
        operation,
        model: options.model,
        attempt,
        max_attempts: maxAttempts,
        status: "schema_error",
        validation_error: lastError,
        finish_reason: choice?.finish_reason,
        usage: completion.usage,
        prompt,
        response: content,
      });
    }

    if (attempt < maxAttempts) {
      messages.push({
        role: "user",
        content:
          `That response did not match the required schema (${lastError}). ` +
          "Start over from the original task and reply again with corrected JSON only. " +
          "Include every required field from the schema, using the exact field names and " +
          "allowed values. Do not repeat malformed JSON from earlier attempts.",
      });
    }
  }

  throw new JsonQueryError(
    `AI response failed schema validation after ${maxAttempts} attempt(s): ${lastError}`,
  );
}
