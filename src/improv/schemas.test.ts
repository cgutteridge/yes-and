import { describe, expect, it } from "vitest";
import {
  buildDirectorSelectionSchema,
  countWords,
  performanceSchema,
  performerNotesPatchSchema,
  turnPlanSchema,
} from "./schemas.js";

describe("countWords", () => {
  it("counts words separated by single spaces", () => {
    // arrange
    const text = "Why is the basement breathing?";

    // act
    const result = countWords(text);

    // assert
    expect(result).toBe(5);
  });

  it("returns zero for an empty string", () => {
    // arrange
    const text = "";

    // act
    const result = countWords(text);

    // assert
    expect(result).toBe(0);
  });

  it("returns zero for whitespace-only text", () => {
    // arrange
    const text = "   \n\t  ";

    // act
    const result = countWords(text);

    // assert
    expect(result).toBe(0);
  });

  it("collapses multiple spaces between words", () => {
    // arrange
    const text = "No.    Never.";

    // act
    const result = countWords(text);

    // assert
    expect(result).toBe(2);
  });
});

describe("performanceSchema", () => {
  it("accepts a single short dialogue entry", () => {
    // arrange
    const candidate = { entries: [{ type: "dialogue", text: "You called him Dad." }] };

    // act
    const result = performanceSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("accepts an action-only entry", () => {
    // arrange
    const candidate = { entries: [{ type: "action", text: "Jon locks the door." }] };

    // act
    const result = performanceSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("accepts a minimal single-word entry", () => {
    // arrange
    const candidate = { entries: [{ type: "dialogue", text: "No." }] };

    // act
    const result = performanceSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("rejects a turn whose combined entries exceed 25 words, naming the actual count", () => {
    // arrange
    const longText = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    const candidate = { entries: [{ type: "dialogue", text: longText }] };

    // act
    const result = performanceSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join("; ");
      expect(messages).toContain("30 words");
    }
  });

  it("rejects a single whitespace-only entry despite satisfying the minimum entry count", () => {
    // arrange
    const candidate = { entries: [{ type: "action", text: "   " }] };

    // act
    const result = performanceSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(false);
  });

  it("rejects an empty entries array", () => {
    // arrange
    const candidate = { entries: [] };

    // act
    const result = performanceSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(false);
  });
});

describe("turnPlanSchema", () => {
  it("accepts a fully-populated valid plan", () => {
    // arrange
    const candidate = {
      current_read: "Leo treats the parcel as evidence; Mina thinks it is a gift.",
      purpose: "Let Mina innocently deepen Leo's suspicion.",
      response_to: "Leo asked who wrapped it.",
      possible_continuations: ["Mina describes the wrapping in alarming terms."],
      commitment: "none",
      confidence: 0.72,
      mode: "offer",
    };

    // act
    const result = turnPlanSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("accepts a panic plan with empty possible_continuations", () => {
    // arrange
    const candidate = {
      current_read: "Leo has gone silent twice when the parcel is mentioned.",
      purpose: "I lack a strong interpretation, so I will invite Leo to define the moment.",
      response_to: "Leo has gone silent twice when the parcel is mentioned.",
      possible_continuations: [],
      commitment: "none",
      confidence: 0.25,
      mode: "panic",
    };

    // act
    const result = turnPlanSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("rejects an invalid mode value", () => {
    // arrange
    const candidate = {
      current_read: "read",
      purpose: "purpose",
      response_to: "",
      possible_continuations: [],
      commitment: "none",
      confidence: 0.5,
      mode: "improvise",
    };

    // act
    const result = turnPlanSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(false);
  });
});

describe("performerNotesPatchSchema", () => {
  it("accepts a patch containing only some fields", () => {
    // arrange
    const candidate = { suspicions: ["Leo is hiding something."] };

    // act
    const result = performerNotesPatchSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });

  it("accepts an empty patch", () => {
    // arrange
    const candidate = {};

    // act
    const result = performerNotesPatchSchema.safeParse(candidate);

    // assert
    expect(result.success).toBe(true);
  });
});

describe("buildDirectorSelectionSchema", () => {
  it("accepts a configured participant id", () => {
    // arrange
    const schema = buildDirectorSelectionSchema(["marta", "leo"]);

    // act
    const result = schema.safeParse({ next: "marta" });

    // assert
    expect(result.success).toBe(true);
  });

  it("accepts the END sentinel", () => {
    // arrange
    const schema = buildDirectorSelectionSchema(["marta", "leo"]);

    // act
    const result = schema.safeParse({ next: "END" });

    // assert
    expect(result.success).toBe(true);
  });

  it("rejects a participant id outside the configured set", () => {
    // arrange
    const schema = buildDirectorSelectionSchema(["marta", "leo"]);

    // act
    const result = schema.safeParse({ next: "someone-else" });

    // assert
    expect(result.success).toBe(false);
  });

  it("accepts an optional private reason", () => {
    // arrange
    const schema = buildDirectorSelectionSchema(["marta"]);

    // act
    const result = schema.safeParse({ next: "marta", reason: "Marta has been quiet for a while." });

    // assert
    expect(result.success).toBe(true);
  });

  it("throws when given no participant ids", () => {
    // arrange
    const buildWithNoParticipants = () => buildDirectorSelectionSchema([]);

    // act & assert
    expect(buildWithNoParticipants).toThrow(Error);
  });
});
