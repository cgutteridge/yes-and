import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { generateAudiencePrompt, type AudiencePromptResult } from "./audiencePrompt.js";
import type { AudiencePromptTypeId } from "./audiencePromptTypes.js";
import { selectSceneSetup } from "./director.js";
import {
  buildSceneConfigFromSetup,
  buildSceneOpeningPrompt,
  generateSceneSetup,
  type GeneratedSceneSetup,
} from "./sceneSetup.js";

function buildAudienceResult(
  promptType: AudiencePromptTypeId,
  index: number,
): AudiencePromptResult {
  return {
    promptType,
    seedWords: ["one", "two", "three"],
    thought: `${promptType} thought ${index}`,
    association: `${promptType} association ${index}`,
    type: promptType,
    suggestion: `${promptType} suggestion ${index}`,
    rationale: `${promptType} rationale ${index}`,
  };
}

describe("generateSceneSetup", () => {
  it("generates scene setup candidates and asks the director to select from them", async () => {
    // arrange
    const calls: AudiencePromptTypeId[] = [];
    const counts = new Map<AudiencePromptTypeId, number>();
    const audiencePromptGenerator: typeof generateAudiencePrompt = vi.fn(
      async (_client, _model, params) => {
        const next = (counts.get(params.promptType) ?? 0) + 1;
        counts.set(params.promptType, next);
        calls.push(params.promptType);
        return buildAudienceResult(params.promptType, next);
      },
    );
    const directorSetupSelector: typeof selectSceneSetup = vi.fn(
      async (_client, _model, params) => {
        expect(params.candidates).toHaveLength(18);
        expect(params.characterCount).toBe(2);
        return {
          location: "location-2",
          item: "item-3",
          challenge: "challenge-1",
          complication: "complication-2",
          characters: ["character-4", "character-6"],
        };
      },
    );

    // act
    const result = await generateSceneSetup({} as OpenAI, "test-model", {
      audiencePromptGenerator,
      directorSetupSelector,
    });

    // assert
    expect(calls.filter((type) => type === "location")).toHaveLength(3);
    expect(calls.filter((type) => type === "item")).toHaveLength(3);
    expect(calls.filter((type) => type === "challenge")).toHaveLength(3);
    expect(calls.filter((type) => type === "complication")).toHaveLength(3);
    expect(calls.filter((type) => type === "character")).toHaveLength(6);
    expect(result.selectedPrompts).toEqual({
      location: "location suggestion 2",
      item: "item suggestion 3",
      challenge: "challenge suggestion 1",
      complication: "complication suggestion 2",
      characters: ["character suggestion 4", "character suggestion 6"],
    });
  });
});

describe("buildSceneOpeningPrompt", () => {
  it("formats the selected prompts for the public transcript", () => {
    // arrange
    const selected = {
      location: "a laundrette",
      item: "a cracked trophy",
      challenge: "pass the inspection",
      complication: "the boss arrives early",
      characters: ["a nervous landlord", "a retired magician"] as [string, string],
    };

    // act
    const result = buildSceneOpeningPrompt(selected);

    // assert
    expect(result).toContain("Location: a laundrette");
    expect(result).toContain("Item: a cracked trophy");
    expect(result).toContain("Challenge: pass the inspection");
    expect(result).toContain("Complication: the boss arrives early");
    expect(result).toContain("- Actor 1: a nervous landlord");
    expect(result).toContain("- Actor 2: a retired magician");
  });
});

describe("buildSceneConfigFromSetup", () => {
  it("creates two isolated AI actors from the selected character suggestions", () => {
    // arrange
    const setup: GeneratedSceneSetup = {
      candidates: [],
      selection: {
        location: "location-1",
        item: "item-1",
        challenge: "challenge-1",
        complication: "complication-1",
        characters: ["character-1", "character-2"],
      },
      selectedPrompts: {
        location: "a laundrette",
        item: "a cracked trophy",
        challenge: "pass the inspection",
        complication: "the boss arrives early",
        characters: ["a nervous landlord", "a retired magician"],
      },
    };

    // act
    const result = buildSceneConfigFromSetup(setup, 12);

    // assert
    expect(result.maximumTurns).toBe(12);
    expect(result.participants).toHaveLength(2);
    expect(result.participants[0]?.character).toContain("a nervous landlord");
    expect(result.participants[0]?.character).toContain("public transcript");
    expect(result.participants[0]?.character).toContain("do not");
    expect(result.participants[1]?.character).toContain("a retired magician");
    expect(result.openingPrompt).toContain("Location: a laundrette");
    expect(result.scriptedTurnsByParticipantId.size).toBe(0);
  });
});
