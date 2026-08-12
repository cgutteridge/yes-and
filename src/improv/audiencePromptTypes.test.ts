import { describe, expect, it } from "vitest";
import {
  audiencePromptTypeIds,
  audiencePromptTypes,
  formatAudiencePromptTypeIds,
  isAudiencePromptTypeId,
} from "./audiencePromptTypes.js";

describe("audiencePromptTypes", () => {
  it("defines the supported command-line ids", () => {
    // assert
    expect(audiencePromptTypeIds).toEqual([
      "location",
      "problem",
      "challenge",
      "character",
      "item",
      "complication",
    ]);
  });

  it("gives each id fuller model-facing instructions", () => {
    // assert
    expect(audiencePromptTypes.character.requestText).toBe("a character or role");
    expect(audiencePromptTypes.character.instructions).toContain("person, job, role");
    expect(audiencePromptTypes.item.requestText).toBe("an item");
    expect(audiencePromptTypes.item.instructions).toContain("concrete object");
  });

  it("recognizes valid ids and rejects adjacent free-form text", () => {
    // assert
    expect(isAudiencePromptTypeId("location")).toBe(true);
    expect(isAudiencePromptTypeId("object")).toBe(false);
    expect(isAudiencePromptTypeId("character/role")).toBe(false);
  });

  it("formats the id list for CLI help and errors", () => {
    // assert
    expect(formatAudiencePromptTypeIds()).toBe(
      "location, problem, challenge, character, item, complication",
    );
  });
});
