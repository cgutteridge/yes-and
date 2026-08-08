import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SceneConfigError } from "../improv/sceneConfig.js";
import { runSceneCommand } from "./sceneCommand.js";

describe("runSceneCommand", () => {
  it("propagates SceneConfigError for an invalid scene-config file, without requiring env config", async () => {
    // arrange
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yesand-scene-test-"));
    const configPath = path.join(dir, "scene.json");
    fs.writeFileSync(configPath, JSON.stringify({ participants: [] }));

    // act & assert
    await expect(runSceneCommand({ config: configPath })).rejects.toThrow(SceneConfigError);
  });
});
