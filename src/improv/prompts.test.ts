import { describe, expect, it } from "vitest";
import {
  buildDirectorNotesUpdatePrompt,
  buildDirectorSelectionPrompt,
  buildPerformerNotesUpdatePrompt,
  buildPerformerPerformancePrompt,
  buildPerformerPlanPrompt,
} from "./prompts.js";
import { initialDirectorNotes, initialPerformerNotes } from "./notes.js";
import type { Participant } from "./types.js";
import type { Performance, TurnPlan } from "./schemas.js";

// Full Participant objects, including `character` -- deliberately NOT narrowed
// to DirectorParticipant, to prove the director builders sanitize at runtime
// rather than relying on the parameter type alone (TS's excess-property check
// doesn't fire when a typed variable, rather than an object literal, is
// passed in -- which is exactly how the real orchestrator calls these).
const fullParticipants: Participant[] = [
  { id: "marta", kind: "ai", displayName: "Marta", character: "SECRET_CHARACTER_DEFINITION_MARTA" },
  { id: "leo", kind: "human", displayName: "Leo", character: undefined },
];

describe("buildDirectorNotesUpdatePrompt", () => {
  it("never includes a participant's character definition, even when passed full Participant objects", () => {
    // arrange
    const params = {
      notes: initialDirectorNotes(),
      transcript: '1. Marta: "Hello."',
      participants: fullParticipants,
      maximumTurns: 20,
    };

    // act
    const prompt = buildDirectorNotesUpdatePrompt(params);

    // assert
    expect(prompt).not.toContain("SECRET_CHARACTER_DEFINITION_MARTA");
  });

  it("includes each participant's id and kind", () => {
    // arrange
    const params = {
      notes: initialDirectorNotes(),
      transcript: "",
      participants: fullParticipants,
      maximumTurns: 20,
    };

    // act
    const prompt = buildDirectorNotesUpdatePrompt(params);

    // assert
    expect(prompt).toContain('"id":"marta"');
    expect(prompt).toContain('"kind":"human"');
  });
});

describe("buildDirectorSelectionPrompt", () => {
  it("never includes a participant's character definition, even when passed full Participant objects", () => {
    // arrange
    const params = {
      notes: initialDirectorNotes(),
      transcript: '1. Marta: "Hello."',
      participants: fullParticipants,
      maximumTurns: 20,
      turnsSoFar: 1,
    };

    // act
    const prompt = buildDirectorSelectionPrompt(params);

    // assert
    expect(prompt).not.toContain("SECRET_CHARACTER_DEFINITION_MARTA");
  });

  it("states the turns-used and maximum-turns figures", () => {
    // arrange
    const params = {
      notes: initialDirectorNotes(),
      transcript: "",
      participants: fullParticipants,
      maximumTurns: 20,
      turnsSoFar: 7,
    };

    // act
    const prompt = buildDirectorSelectionPrompt(params);

    // assert
    expect(prompt).toContain("7 of a maximum 20 turns");
  });
});

describe("buildPerformerPlanPrompt", () => {
  it("includes the character definition, notes, and transcript", () => {
    // arrange
    const params = {
      character: "A suspicious sister who trusts no one.",
      notes: { ...initialPerformerNotes(), suspicions: ["Leo is hiding something."] },
      transcript: '1. Leo: "Nothing to see here."',
    };

    // act
    const prompt = buildPerformerPlanPrompt(params);

    // assert
    expect(prompt).toContain("A suspicious sister who trusts no one.");
    expect(prompt).toContain("Leo is hiding something.");
    expect(prompt).toContain('1. Leo: "Nothing to see here."');
  });

  it("instructs an empty-string response_to and a 0-1 confidence range, to avoid observed model mistakes", () => {
    // arrange
    const params = {
      character: "A performer.",
      notes: initialPerformerNotes(),
      transcript: "",
    };

    // act
    const prompt = buildPerformerPlanPrompt(params);

    // assert
    expect(prompt).toContain("empty string for response_to");
    expect(prompt).toContain("between 0 and 1 inclusive");
  });
});

describe("buildPerformerPerformancePrompt", () => {
  it("embeds the Stage A plan's fields", () => {
    // arrange
    const plan: TurnPlan = {
      current_read: "Leo is deflecting.",
      purpose: "Press gently on the deflection.",
      response_to: "Nothing to see here.",
      possible_continuations: [],
      commitment: "none",
      confidence: 0.6,
      mode: "clarify",
    };
    const params = {
      character: "A suspicious sister.",
      notes: initialPerformerNotes(),
      transcript: "",
      plan,
    };

    // act
    const prompt = buildPerformerPerformancePrompt(params);

    // assert
    expect(prompt).toContain("Leo is deflecting.");
    expect(prompt).toContain("Press gently on the deflection.");
  });
});

describe("buildPerformerNotesUpdatePrompt", () => {
  it("includes the plan and performance from this turn", () => {
    // arrange
    const plan: TurnPlan = {
      current_read: "read",
      purpose: "purpose",
      response_to: "",
      possible_continuations: [],
      commitment: "none",
      confidence: 0.5,
      mode: "offer",
    };
    const performance: Performance = { entries: [{ type: "dialogue", text: "Does it tick?" }] };
    const params = {
      character: "A suspicious sister.",
      notes: initialPerformerNotes(),
      transcript: "",
      plan,
      performance,
    };

    // act
    const prompt = buildPerformerNotesUpdatePrompt(params);

    // assert
    expect(prompt).toContain("Does it tick?");
  });
});
