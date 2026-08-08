import { describe, expect, it } from "vitest";
import { selectNextParticipant, updateDirectorNotes } from "./director.js";
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
