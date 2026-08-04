import { describe, expect, it } from "vitest";
import { exampleSchemas } from "./exampleSchemas.js";

describe("summary schema", () => {
  it("accepts a well-formed summary", () => {
    // arrange
    const candidate = {
      topic: "cats",
      summary: "Cats are mammals.",
      keyPoints: ["independent", "carnivorous"],
    };

    // act
    const result = exampleSchemas.summary.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("rejects a summary missing keyPoints", () => {
    // arrange
    const candidate = { topic: "cats", summary: "Cats are mammals." };

    // act
    const result = exampleSchemas.summary.safeParse(candidate);

    // assert
    expect(result.success).toBe(false);
  });
});

describe("sentiment schema", () => {
  it("accepts a well-formed sentiment", () => {
    // arrange
    const candidate = { sentiment: "positive", confidence: 0.9 };

    // act
    const result = exampleSchemas.sentiment.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("rejects a sentiment value outside the allowed enum", () => {
    // arrange
    const candidate = { sentiment: "ecstatic", confidence: 0.9 };

    // act
    const result = exampleSchemas.sentiment.safeParse(candidate);

    // assert
    expect(result.success).toBe(false);
  });
});
