import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("returns a typed config when all required variables are present", () => {
    // arrange
    const env = { AI_API_KEY: "sk-test", AI_MODEL: "gpt-4o-mini" };

    // act
    const result = loadConfig(env);

    // assert
    expect(result).toEqual({
      apiKey: "sk-test",
      baseUrl: undefined,
      model: "gpt-4o-mini",
      aiLogPath: "logs/ai-usage.jsonl",
    });
  });

  it("accepts an optional AI_BASE_URL override", () => {
    // arrange
    const env = {
      AI_API_KEY: "sk-test",
      AI_MODEL: "gpt-4o-mini",
      AI_BASE_URL: "https://example.com/v1",
    };

    // act
    const result = loadConfig(env);

    // assert
    expect(result.baseUrl).toBe("https://example.com/v1");
  });

  it("accepts an optional AI_LOG_PATH override", () => {
    // arrange
    const env = {
      AI_API_KEY: "sk-test",
      AI_MODEL: "gpt-4o-mini",
      AI_LOG_PATH: "tmp/ai.jsonl",
    };

    // act
    const result = loadConfig(env);

    // assert
    expect(result.aiLogPath).toBe("tmp/ai.jsonl");
  });

  it("throws a ConfigError when AI_API_KEY is missing", () => {
    // arrange
    const env = { AI_MODEL: "gpt-4o-mini" };

    // act
    const act = () => loadConfig(env);

    // assert
    expect(act).toThrow(ConfigError);
  });

  it("throws a ConfigError when AI_BASE_URL is not a valid URL", () => {
    // arrange
    const env = { AI_API_KEY: "sk-test", AI_MODEL: "gpt-4o-mini", AI_BASE_URL: "not-a-url" };

    // act
    const act = () => loadConfig(env);

    // assert
    expect(act).toThrow(ConfigError);
  });
});
