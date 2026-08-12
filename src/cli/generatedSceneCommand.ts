import { loadConfig } from "../config/env.js";
import { runScene } from "../improv/orchestrator.js";
import { buildSceneConfigFromSetup, generateSceneSetup } from "../improv/sceneSetup.js";
import { createAiClient } from "../services/aiClient.js";
import { logger } from "../utils/logger.js";

export interface GeneratedSceneCommandOptions {
  maximumTurns: number;
}

export async function runGeneratedSceneCommand(
  options: GeneratedSceneCommandOptions,
): Promise<void> {
  if (!Number.isInteger(options.maximumTurns) || options.maximumTurns <= 0) {
    logger.error("--maximum-turns must be a positive integer");
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const client = createAiClient(config);

  logger.info("Generating audience suggestions for a full scene setup...");
  logger.info(`AI attempt log: ${config.aiLogPath}`);
  logger.info(`Full AI API log: ${config.aiFullLogPath}`);
  const setup = await generateSceneSetup(client, config.model, {
    aiLogPath: config.aiLogPath,
    aiFullLogPath: config.aiFullLogPath,
    onProgress: (message) => logger.info(message),
  });
  const sceneConfig = buildSceneConfigFromSetup(setup, options.maximumTurns);

  logger.info("Selected scene setup:");
  logger.info(sceneConfig.openingPrompt ?? "");
  logger.info("Starting scene...");
  const scene = await runScene(client, config.model, sceneConfig, {
    aiLogPath: config.aiLogPath,
    aiFullLogPath: config.aiFullLogPath,
    onProgress: (message) => logger.info(message),
  });
  logger.info(`Scene ended by: ${scene.endedBy}`);

  console.log(JSON.stringify({ setup, scene }, null, 2));
}
