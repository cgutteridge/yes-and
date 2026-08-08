import { loadConfig } from "../config/env.js";
import { runScene } from "../improv/orchestrator.js";
import { loadSceneConfigFromFile } from "../improv/sceneConfig.js";
import { createAiClient } from "../services/aiClient.js";

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
  const result = await runScene(client, appConfig.model, sceneConfig);
  console.log(JSON.stringify(result, null, 2));
}
