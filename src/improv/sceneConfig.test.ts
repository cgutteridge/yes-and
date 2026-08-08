import { describe, expect, it } from "vitest";
import { parseSceneConfig, SceneConfigError } from "./sceneConfig.js";

function validRawConfig() {
  return {
    participants: [
      { id: "marta", kind: "ai", display_name: "Marta", character: "A suspicious sister." },
      {
        id: "leo",
        kind: "human",
        display_name: "Leo",
        scripted_turns: [[{ type: "dialogue", text: "Nothing to see here." }]],
      },
    ],
    opening_prompt_mode: "audience",
    opening_prompt: "A courtroom in a fruit-packing shed.",
    actor_deliberation_mode: "two_stage",
    maximum_turns: 20,
  };
}

describe("parseSceneConfig", () => {
  it("accepts a minimal valid config and maps snake_case keys to camelCase", () => {
    // arrange
    const raw = validRawConfig();

    // act
    const result = parseSceneConfig(raw);

    // assert
    expect(result.openingPrompt).toBe("A courtroom in a fruit-packing shed.");
    expect(result.maximumTurns).toBe(20);
    expect(result.participants).toEqual([
      { id: "marta", kind: "ai", displayName: "Marta", character: "A suspicious sister." },
      { id: "leo", kind: "human", displayName: "Leo", character: undefined },
    ]);
    expect(result.scriptedTurnsByParticipantId.get("leo")).toEqual([
      [{ type: "dialogue", text: "Nothing to see here." }],
    ]);
  });

  it("throws naming the exact unsupported opening_prompt_mode value", () => {
    // arrange
    const raw = { ...validRawConfig(), opening_prompt_mode: "generated" };

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(SceneConfigError);
    expect(parse).toThrow(/generated/);
  });

  it("throws naming the exact unsupported actor_deliberation_mode value", () => {
    // arrange
    const raw = { ...validRawConfig(), actor_deliberation_mode: "off" };

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(SceneConfigError);
    expect(parse).toThrow(/"off"/);
  });

  it("throws when opening_prompt is missing under audience mode", () => {
    // arrange
    const raw = validRawConfig() as Record<string, unknown>;
    delete raw.opening_prompt;

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(SceneConfigError);
  });

  it("throws on a duplicate participant id", () => {
    // arrange
    const raw = validRawConfig();
    raw.participants[1]!.id = "marta";

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(/duplicate/i);
  });

  it('throws on a participant id of "END"', () => {
    // arrange
    const raw = validRawConfig();
    raw.participants[0]!.id = "END";

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(SceneConfigError);
  });

  it("throws when an ai participant has no character", () => {
    // arrange
    const raw = validRawConfig();
    delete (raw.participants[0] as { character?: string }).character;

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(/character/);
  });

  it("throws when a human participant has no scripted_turns", () => {
    // arrange
    const raw = validRawConfig();
    delete (raw.participants[1] as { scripted_turns?: unknown }).scripted_turns;

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(/scripted_turns/);
  });

  it("throws a formatted SceneConfigError when the raw input fails schema validation entirely", () => {
    // arrange
    const raw = { ...validRawConfig(), participants: [] };

    // act
    const parse = () => parseSceneConfig(raw);

    // assert
    expect(parse).toThrow(SceneConfigError);
    expect(parse).toThrow(/Invalid scene configuration/);
  });
});
