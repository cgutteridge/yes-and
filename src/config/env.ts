import { z } from "zod";

const envSchema = z.object({
  AI_API_KEY: z.string().min(1, "is required"),
  AI_BASE_URL: z.string().url("must be a valid URL").optional(),
  AI_MODEL: z.string().min(1, "is required"),
  AI_LOG_PATH: z.string().min(1, "must not be empty").optional(),
  AI_FULL_LOG_PATH: z.string().min(1, "must not be empty").optional(),
});

export interface AppConfig {
  apiKey: string;
  baseUrl: string | undefined;
  model: string;
  aiLogPath: string;
  aiFullLogPath: string;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".")} ${issue.message}`,
    );
    throw new ConfigError(
      [
        "Invalid environment configuration:",
        ...issues,
        "",
        "Copy .env.example to .env and fill in the required values.",
      ].join("\n"),
    );
  }

  return {
    apiKey: parsed.data.AI_API_KEY,
    baseUrl: parsed.data.AI_BASE_URL,
    model: parsed.data.AI_MODEL,
    aiLogPath: parsed.data.AI_LOG_PATH ?? "logs/ai-usage.jsonl",
    aiFullLogPath: parsed.data.AI_FULL_LOG_PATH ?? "logs/ai-full.jsonl",
  };
}
