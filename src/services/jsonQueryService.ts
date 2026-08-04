import type OpenAI from "openai";
import { z } from "zod";
import { logger } from "../utils/logger.js";

export interface JsonQueryOptions {
  model: string;
  maxAttempts?: number;
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
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(schema) },
    { role: "user", content: prompt },
  ];

  let lastError = "no attempts were made";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.debug(`AI query attempt ${attempt}/${maxAttempts}`);

    const completion = await client.chat.completions.create({
      model: options.model,
      messages,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const outcome = parseAgainstSchema(content, schema);

    if (outcome.success) {
      return outcome.data;
    }

    lastError = outcome.error;
    logger.debug(`attempt ${attempt} failed schema validation: ${lastError}`);

    if (attempt < maxAttempts) {
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `That response did not match the required schema (${lastError}). Reply again with corrected JSON only.`,
      });
    }
  }

  throw new JsonQueryError(
    `AI response failed schema validation after ${maxAttempts} attempt(s): ${lastError}`,
  );
}
