import { describe, expect, it, type Mock } from "vitest";
import { runScene, ScriptedEntriesExhaustedError } from "./orchestrator.js";
import { fakeClient } from "./testing/fakeClient.js";
import type { SceneConfig } from "./sceneConfig.js";
import type { TranscriptEntry } from "./types.js";

function buildConfig(overrides: Partial<SceneConfig> = {}): SceneConfig {
  return {
    participants: [
      { id: "alice", kind: "ai", displayName: "Alice", character: "A performer." },
      { id: "bob", kind: "ai", displayName: "Bob", character: "Another performer." },
    ],
    openingPrompt: "An opening prompt.",
    maximumTurns: 10,
    scriptedTurnsByParticipantId: new Map<string, TranscriptEntry[][]>(),
    ...overrides,
  };
}

const EMPTY_PATCH_JSON = "{}";

function selectionJson(next: string): string {
  return JSON.stringify({ next });
}

function planJson(): string {
  return JSON.stringify({
    current_read: "read",
    purpose: "purpose",
    response_to: "",
    possible_continuations: [],
    commitment: "none",
    confidence: 0.5,
    mode: "offer",
  });
}

function performanceJson(text: string): string {
  return JSON.stringify({ entries: [{ type: "dialogue", text }] });
}

function promptAt(create: Mock, index: number): string {
  const call = create.mock.calls[index] as [{ messages: Array<{ content: string }> }];
  const userMessage = call[0].messages[1];
  if (!userMessage) {
    throw new Error(`expected a user message at index 1 for call ${index}`);
  }
  return userMessage.content;
}

describe("runScene", () => {
  it("produces a transcript in director-selection order and stops on END", async () => {
    // arrange
    const config = buildConfig({
      participants: [
        { id: "leo", kind: "human", displayName: "Leo", character: undefined },
        { id: "alice", kind: "ai", displayName: "Alice", character: "A performer." },
      ],
      scriptedTurnsByParticipantId: new Map([
        ["leo", [[{ type: "dialogue", text: "Nothing to see here." }]]],
      ]),
    });
    const { client } = fakeClient(
      EMPTY_PATCH_JSON, // director notes (turn 1)
      selectionJson("leo"), // director selects leo
      EMPTY_PATCH_JSON, // director notes (turn 2)
      selectionJson("alice"), // director selects alice
      planJson(),
      performanceJson("Does it tick?"),
      EMPTY_PATCH_JSON, // alice's notes patch
      EMPTY_PATCH_JSON, // director notes (turn 3)
      selectionJson("END"),
    );

    // act
    const result = await runScene(client, "test-model", config);

    // assert
    expect(result.endedBy).toBe("director");
    expect(result.transcript.turns).toEqual([
      {
        turn: 1,
        participantId: "leo",
        entries: [{ type: "dialogue", text: "Nothing to see here." }],
      },
      { turn: 2, participantId: "alice", entries: [{ type: "dialogue", text: "Does it tick?" }] },
    ]);
  });

  it("stops at exactly maximumTurns with endedBy turn_limit when the director never ends", async () => {
    // arrange
    const config = buildConfig({
      participants: [{ id: "alice", kind: "ai", displayName: "Alice", character: "A performer." }],
      maximumTurns: 2,
    });
    const { client, create } = fakeClient(
      EMPTY_PATCH_JSON,
      selectionJson("alice"),
      planJson(),
      performanceJson("Line one."),
      EMPTY_PATCH_JSON,
      EMPTY_PATCH_JSON,
      selectionJson("alice"),
      planJson(),
      performanceJson("Line two."),
      EMPTY_PATCH_JSON,
    );

    // act
    const result = await runScene(client, "test-model", config);

    // assert
    expect(result.endedBy).toBe("turn_limit");
    expect(result.transcript.turns).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(10);
  });

  it("throws ScriptedEntriesExhaustedError when a human's scripted queue runs out", async () => {
    // arrange
    const config = buildConfig({
      participants: [{ id: "leo", kind: "human", displayName: "Leo", character: undefined }],
      maximumTurns: 5,
      scriptedTurnsByParticipantId: new Map([
        ["leo", [[{ type: "dialogue", text: "Only line." }]]],
      ]),
    });
    const { client } = fakeClient(
      EMPTY_PATCH_JSON,
      selectionJson("leo"), // consumes leo's one scripted turn
      EMPTY_PATCH_JSON,
      selectionJson("leo"), // leo selected again, queue now empty
    );

    // act & assert
    await expect(runScene(client, "test-model", config)).rejects.toThrow(
      ScriptedEntriesExhaustedError,
    );
  });

  it("keeps each AI performer's private notes isolated from the other performer and from the director", async () => {
    // arrange
    const config = buildConfig({ maximumTurns: 10 });
    const { client, create } = fakeClient(
      JSON.stringify({ audience_suspects: ["SENTINEL_DIRECTOR_NOTE"] }), // director notes (turn 1)
      selectionJson("alice"),
      planJson(),
      performanceJson("Alice speaks."),
      JSON.stringify({ suspicions: ["SENTINEL_ALICE_NOTE"] }), // alice's own notes patch
      EMPTY_PATCH_JSON, // director notes (turn 2) -- unchanged
      selectionJson("bob"),
      planJson(),
      performanceJson("Bob speaks."),
      EMPTY_PATCH_JSON, // bob's own notes patch
      EMPTY_PATCH_JSON, // director notes (turn 3)
      selectionJson("END"),
    );

    // act
    await runScene(client, "test-model", config);

    // assert -- alice's own calls (indices 2,3,4) never see the director's sentinel
    for (const index of [2, 3, 4]) {
      expect(promptAt(create, index)).not.toContain("SENTINEL_DIRECTOR_NOTE");
    }
    // bob's calls (indices 7,8,9) never see alice's sentinel or the director's
    for (const index of [7, 8, 9]) {
      expect(promptAt(create, index)).not.toContain("SENTINEL_ALICE_NOTE");
      expect(promptAt(create, index)).not.toContain("SENTINEL_DIRECTOR_NOTE");
    }
    // the director's later calls (indices 5,6,10,11) never see alice's private notes sentinel
    for (const index of [5, 6, 10, 11]) {
      expect(promptAt(create, index)).not.toContain("SENTINEL_ALICE_NOTE");
    }
    expect(create).toHaveBeenCalledTimes(12);
  });
});
