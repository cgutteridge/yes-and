import { loadConfig } from "../config/env.js";
import { generateAudiencePrompt } from "../improv/audiencePrompt.js";
import {
  formatAudiencePromptTypeIds,
  isAudiencePromptTypeId,
} from "../improv/audiencePromptTypes.js";
import { createAiClient } from "../services/aiClient.js";
import { logger } from "../utils/logger.js";

export async function runAudiencePromptCommand(promptType: string): Promise<void> {
  const trimmedPromptType = promptType.trim();
  if (trimmedPromptType === "") {
    logger.error("audience prompt type must not be empty");
    process.exitCode = 1;
    return;
  }
  if (!isAudiencePromptTypeId(trimmedPromptType)) {
    logger.error(
      `unknown audience prompt type "${trimmedPromptType}". Available: ${formatAudiencePromptTypeIds()}`,
    );
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const client = createAiClient(config);

  logger.info(`Audience prompt demo: ${trimmedPromptType}`);
  logger.info("Step 1: select three random words from the dictionary.");
  const result = await generateAudiencePrompt(client, config.model, {
    promptType: trimmedPromptType,
    aiLogPath: config.aiLogPath,
    aiFullLogPath: config.aiFullLogPath,
    onProgress: (message) => logger.info(message),
  });
  logger.info("Result:");

  console.log(JSON.stringify(result, null, 2));
}
