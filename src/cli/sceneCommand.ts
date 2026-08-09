import { loadConfig } from "../config/env.js";
import { runScene } from "../improv/orchestrator.js";
import { loadSceneConfigFromFile } from "../improv/sceneConfig.js";
import { createAiClient } from "../services/aiClient.js";
import { logger } from "../utils/logger.js";

export interface SceneCommandOptions {
  config: string;
}

/**
 * Loads a scene-config file, runs it end-to-end against the real
 * configured API, and prints the resulting transcript as JSON -- same
 * stdout convention as the query command's result.
 *
 * Deliberately validates the scene-config file BEFORE loading env config
 * or creating a client: a bad --config path is the more likely mistake
 * during authoring/dev, and it should fail fast without also requiring a
 * fully-configured .env just to report that.
 */
export async function runSceneCommand(options: SceneCommandOptions): Promise<void> {
  const sceneConfig = loadSceneConfigFromFile(options.config);
  const appConfig = loadConfig();
  const client = createAiClient(appConfig);
  logger.info(`Scene: ${options.config}`);
  logger.info(`Opening: ${sceneConfig.openingPrompt}`);
  logger.info(`Maximum turns: ${sceneConfig.maximumTurns}`);
  logger.info("Participants:");
  for (const participant of sceneConfig.participants) {
    const detail = participant.character ? ` -- ${participant.character}` : "";
    logger.info(`- ${participant.displayName} (${participant.kind})${detail}`);
  }
  logger.info(`AI attempt log: ${appConfig.aiLogPath}`);
  logger.info("Starting scene...");
  const result = await runScene(client, appConfig.model, sceneConfig, {
    aiLogPath: appConfig.aiLogPath,
    onProgress: (message) => logger.info(message),
  });
  logger.info(`Scene ended by: ${result.endedBy}`);
  console.log(JSON.stringify(result, null, 2));
}
