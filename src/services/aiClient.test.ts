import { describe, expect, it } from "vitest";
import { createAiClient } from "./aiClient.js";

describe("createAiClient", () => {
  it("configures the client with the provided api key and base url", () => {
    // arrange
    const config = {
      apiKey: "sk-test",
      baseUrl: "https://example.com/v1",
      model: "gpt-4o-mini",
      aiLogPath: "logs/ai-usage.jsonl",
    };

    // act
    const client = createAiClient(config);

    // assert
    expect(client.apiKey).toBe("sk-test");
    expect(client.baseURL).toBe("https://example.com/v1");
  });
});
