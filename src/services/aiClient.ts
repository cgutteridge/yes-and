import OpenAI from "openai";
import type { AppConfig } from "../config/env.js";

export function createAiClient(config: AppConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
}
