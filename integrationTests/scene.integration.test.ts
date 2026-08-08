import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { runScene } from "../src/improv/orchestrator.js";
import { loadSceneConfigFromFile } from "../src/improv/sceneConfig.js";
import { createAiClient } from "../src/services/aiClient.js";

const hasRealCredentials = Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);

// Custom 120s timeout below (well beyond this file's default 30s): a scene
// involves several sequential real API round-trips per turn (director
// notes, director selection, and -- for AI turns -- plan/performance/notes).
describe.skipIf(!hasRealCredentials)("runScene against a real AI API", () => {
  it("completes a short scripted scene with non-empty entries on every AI turn", async () => {
    // arrange
    const config = loadConfig();
    const client = createAiClient(config);
    const sceneConfig = loadSceneConfigFromFile("fixtures/scenes/integration-smoke-scene.json");

    // act
    const result = await runScene(client, config.model, sceneConfig);

    // assert -- structural properties only; creative/behavioral quality is a manual-run concern, not an automated one
    expect(result.transcript.turns.length).toBeGreaterThan(0);
    for (const turn of result.transcript.turns) {
      expect(turn.entries.length).toBeGreaterThan(0);
      for (const entry of turn.entries) {
        expect(entry.text.trim().length).toBeGreaterThan(0);
      }
    }
  }, 120_000);
});
