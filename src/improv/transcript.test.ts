import { describe, expect, it } from "vitest";
import type { Participant, Transcript } from "./types.js";
import { appendTurn, renderTranscript } from "./transcript.js";

const emptyTranscript: Transcript = { openingPrompt: undefined, turns: [] };

const participants: Participant[] = [
  { id: "marta", kind: "ai", displayName: "Marta", character: "A suspicious sister." },
  { id: "leo", kind: "human", displayName: "Leo", character: undefined },
];

describe("appendTurn", () => {
  it("assigns sequential turn numbers starting from 1", () => {
    // arrange
    const first = appendTurn(emptyTranscript, "marta", [{ type: "dialogue", text: "Hello." }]);

    // act
    const second = appendTurn(first, "leo", [{ type: "action", text: "Leo waves." }]);

    // assert
    expect(second.turns.map((turn) => turn.turn)).toEqual([1, 2]);
  });

  it("does not mutate the input transcript", () => {
    // arrange
    const before = { ...emptyTranscript, turns: [...emptyTranscript.turns] };

    // act
    appendTurn(emptyTranscript, "marta", [{ type: "dialogue", text: "Hello." }]);

    // assert
    expect(emptyTranscript).toEqual(before);
  });

  it("preserves the opening prompt across appends", () => {
    // arrange
    const transcript: Transcript = { openingPrompt: "A courtroom in a fruit shed.", turns: [] };

    // act
    const result = appendTurn(transcript, "marta", [{ type: "dialogue", text: "Order!" }]);

    // assert
    expect(result.openingPrompt).toBe("A courtroom in a fruit shed.");
  });
});

describe("renderTranscript", () => {
  it("renders a dialogue entry in quotes with the participant's display name", () => {
    // arrange
    const transcript = appendTurn(emptyTranscript, "marta", [
      { type: "dialogue", text: "You called him Dad." },
    ]);

    // act
    const rendered = renderTranscript(transcript, participants);

    // assert
    expect(rendered).toBe('1. Marta: "You called him Dad."');
  });

  it("renders an action entry with asterisks", () => {
    // arrange
    const transcript = appendTurn(emptyTranscript, "leo", [
      { type: "action", text: "Leo locks the door." },
    ]);

    // act
    const rendered = renderTranscript(transcript, participants);

    // assert
    expect(rendered).toBe("1. Leo: *Leo locks the door.*");
  });

  it("renders multiple entries within one turn on the same line", () => {
    // arrange
    const transcript = appendTurn(emptyTranscript, "marta", [
      { type: "dialogue", text: "Does the parcel normally tick?" },
      { type: "action", text: "Marta steps back." },
    ]);

    // act
    const rendered = renderTranscript(transcript, participants);

    // assert
    expect(rendered).toBe('1. Marta: "Does the parcel normally tick?" *Marta steps back.*');
  });

  it("includes an opening-prompt header line when present", () => {
    // arrange
    const transcript: Transcript = { openingPrompt: "A courtroom in a fruit shed.", turns: [] };

    // act
    const rendered = renderTranscript(transcript, participants);

    // assert
    expect(rendered).toBe("Opening prompt: A courtroom in a fruit shed.");
  });

  it("omits the opening-prompt header when absent", () => {
    // arrange
    const transcript = appendTurn(emptyTranscript, "marta", [{ type: "dialogue", text: "Hi." }]);

    // act
    const rendered = renderTranscript(transcript, participants);

    // assert
    expect(rendered.startsWith("Opening prompt:")).toBe(false);
  });

  it("falls back to the raw participant id when no matching participant is found", () => {
    // arrange
    const transcript = appendTurn(emptyTranscript, "unknown-id", [
      { type: "dialogue", text: "Hi." },
    ]);

    // act
    const rendered = renderTranscript(transcript, participants);

    // assert
    expect(rendered).toBe('1. unknown-id: "Hi."');
  });
});
