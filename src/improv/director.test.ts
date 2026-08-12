import { describe, expect, it } from "vitest";
import { selectNextParticipant, selectSceneSetup, updateDirectorNotes } from "./director.js";
import { initialDirectorNotes } from "./notes.js";
import { fakeClient } from "./testing/fakeClient.js";
import type { DirectorParticipant } from "./prompts.js";

const participants: DirectorParticipant[] = [
  { id: "marta", kind: "ai", displayName: "Marta" },
  { id: "leo", kind: "human", displayName: "Leo" },
];

describe("selectNextParticipant", () => {
  it("returns the participant id the model selects", async () => {
    // arrange
    const { client } = fakeClient(JSON.stringify({ next: "marta" }));

    // act
    const result = await selectNextParticipant(client, "test-model", {
      notes: initialDirectorNotes(),
      transcript: "",
      participants,
      maximumTurns: 20,
      turnsSoFar: 0,
    });

    // assert
    expect(result).toBe("marta");
  });

  it("returns END when the model selects it", async () => {
    // arrange
    const { client } = fakeClient(JSON.stringify({ next: "END" }));

    // act
    const result = await selectNextParticipant(client, "test-model", {
      notes: initialDirectorNotes(),
      transcript: "",
      participants,
      maximumTurns: 20,
      turnsSoFar: 20,
    });

    // assert
    expect(result).toBe("END");
  });

  it("retries when the model names a participant outside the configured set, then succeeds", async () => {
    // arrange
    const { client, create } = fakeClient(
      JSON.stringify({ next: "someone-else" }),
      JSON.stringify({ next: "leo" }),
    );

    // act
    const result = await selectNextParticipant(client, "test-model", {
      notes: initialDirectorNotes(),
      transcript: "",
      participants,
      maximumTurns: 20,
      turnsSoFar: 3,
    });

    // assert
    expect(result).toBe("leo");
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("selectSceneSetup", () => {
  const setupCandidates = [
    { id: "location-1", type: "location" as const, suggestion: "a laundrette" },
    { id: "item-1", type: "item" as const, suggestion: "a trophy" },
    { id: "challenge-1", type: "challenge" as const, suggestion: "pass inspection" },
    { id: "complication-1", type: "complication" as const, suggestion: "the boss arrives" },
    { id: "character-1", type: "character" as const, suggestion: "a landlord" },
    { id: "character-2", type: "character" as const, suggestion: "a magician" },
  ];

  it("returns the setup candidate ids the model selects", async () => {
    // arrange
    const { client } = fakeClient(
      JSON.stringify({
        location: "location-1",
        item: "item-1",
        challenge: "challenge-1",
        complication: "complication-1",
        characters: ["character-1", "character-2"],
      }),
    );

    // act
    const result = await selectSceneSetup(client, "test-model", {
      candidates: setupCandidates,
      characterCount: 2,
    });

    // assert
    expect(result.characters).toEqual(["character-1", "character-2"]);
  });
});

describe("updateDirectorNotes", () => {
  it("applies the returned patch on top of the base notes, leaving absent fields untouched", async () => {
    // arrange
    const base = { ...initialDirectorNotes(), energy: "peak" as const };
    const { client } = fakeClient(JSON.stringify({ tempo: "fast" }));

    // act
    const result = await updateDirectorNotes(client, "test-model", {
      notes: base,
      transcript: "",
      participants,
      maximumTurns: 20,
    });

    // assert
    expect(result.tempo).toBe("fast");
    expect(result.energy).toBe("peak");
  });
});
