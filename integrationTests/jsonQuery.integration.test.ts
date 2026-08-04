import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createAiClient } from "../src/services/aiClient.js";
import { runJsonQuery } from "../src/services/jsonQueryService.js";
import { exampleSchemas } from "../src/schemas/exampleSchemas.js";

const hasRealCredentials = Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);

describe.skipIf(!hasRealCredentials)("runJsonQuery against a real AI API", () => {
  it("returns a response that matches the summary schema", async () => {
    // arrange
    const config = loadConfig();
    const client = createAiClient(config);

    // act
    const result = await runJsonQuery(
      client,
      exampleSchemas.summary,
      "Summarize this in a few words: the sky looks blue because of Rayleigh scattering of sunlight.",
      { model: config.model },
    );

    // assert
    expect(exampleSchemas.summary.safeParse(result).success).toBe(true);
  });
});
