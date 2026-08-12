import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type OpenAI from "openai";
import { logger } from "../utils/logger.js";

export interface AiUsageLogEntry {
  timestamp: string;
  operation: string;
  model: string;
  temperature?: number;
  attempt: number;
  max_attempts: number;
  status: "validated" | "schema_error" | "api_error";
  validation_error?: string;
  finish_reason?: string | null;
  usage?: OpenAI.Chat.Completions.ChatCompletion["usage"];
  system_prompt: string;
  prompt: string;
  response?: string;
}

export interface AiFullLogEntry {
  timestamp: string;
  operation: string;
  model: string;
  temperature?: number;
  attempt: number;
  max_attempts: number;
  status: "response" | "api_error";
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export async function appendAiUsageLog(path: string, entry: AiUsageLogEntry): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    logger.debug(`failed to write AI usage log "${path}": ${(error as Error).message}`);
  }
}

export async function appendAiFullLog(path: string, entry: AiFullLogEntry): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    logger.debug(`failed to write full AI log "${path}": ${(error as Error).message}`);
  }
}
