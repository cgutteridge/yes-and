import { describe, expect, it } from "vitest";
import {
  applyDirectorNotesPatch,
  applyPerformerNotesPatch,
  initialDirectorNotes,
  initialPerformerNotes,
} from "./notes.js";

describe("initialPerformerNotes", () => {
  it("returns all-empty arrays and an empty relationships record", () => {
    // arrange & act
    const notes = initialPerformerNotes();

    // assert
    expect(notes).toEqual({
      character_beliefs: [],
      character_wants: [],
      relationships: {},
      facts_known: [],
      suspicions: [],
      unresolved_offers: [],
      promises_and_patterns: [],
      possible_payoffs: [],
      character_discoveries: [],
      boundaries: [],
      discarded_ideas: [],
    });
  });
});

describe("initialDirectorNotes", () => {
  it("returns the documented zeroed defaults", () => {
    // arrange & act
    const notes = initialDirectorNotes();

    // assert
    expect(notes).toEqual({
      audience_knows: [],
      audience_suspects: [],
      audience_expects: [],
      dramatic_ironies: [],
      active_patterns: [],
      open_questions: [],
      focus_history: [],
      tempo: "normal",
      energy: "building",
      ending_opportunities: [],
      stagnation_count: 0,
    });
  });
});

describe("applyPerformerNotesPatch", () => {
  it("replaces a present array field entirely rather than appending", () => {
    // arrange
    const base = { ...initialPerformerNotes(), suspicions: ["Leo is hiding something."] };
    const patch = { suspicions: ["Leo is definitely hiding something."] };

    // act
    const result = applyPerformerNotesPatch(base, patch);

    // assert
    expect(result.suspicions).toEqual(["Leo is definitely hiding something."]);
  });

  it("leaves a field untouched when absent from the patch", () => {
    // arrange
    const base = { ...initialPerformerNotes(), facts_known: ["The parcel ticks."] };
    const patch = { suspicions: ["Something new."] };

    // act
    const result = applyPerformerNotesPatch(base, patch);

    // assert
    expect(result.facts_known).toEqual(["The parcel ticks."]);
  });

  it("lets possible_payoffs shrink, since payoffs must be able to expire", () => {
    // arrange
    const base = {
      ...initialPerformerNotes(),
      possible_payoffs: ["The parcel is a bomb.", "The parcel is a gift."],
    };
    const patch = { possible_payoffs: [] };

    // act
    const result = applyPerformerNotesPatch(base, patch);

    // assert
    expect(result.possible_payoffs).toEqual([]);
  });

  it("appends and dedupes discarded_ideas instead of replacing", () => {
    // arrange
    const base = { ...initialPerformerNotes(), discarded_ideas: ["reveal the twin"] };
    const patch = { discarded_ideas: ["reveal the twin", "fake the death"] };

    // act
    const result = applyPerformerNotesPatch(base, patch);

    // assert
    expect(result.discarded_ideas).toEqual(["reveal the twin", "fake the death"]);
  });

  it("leaves discarded_ideas untouched when absent from the patch", () => {
    // arrange
    const base = { ...initialPerformerNotes(), discarded_ideas: ["reveal the twin"] };
    const patch = { suspicions: ["unrelated update"] };

    // act
    const result = applyPerformerNotesPatch(base, patch);

    // assert
    expect(result.discarded_ideas).toEqual(["reveal the twin"]);
  });

  it("replaces the relationships record entirely when present in the patch", () => {
    // arrange
    const base = { ...initialPerformerNotes(), relationships: { leo: "brother" } };
    const patch = { relationships: { leo: "brother", mina: "rival" } };

    // act
    const result = applyPerformerNotesPatch(base, patch);

    // assert
    expect(result.relationships).toEqual({ leo: "brother", mina: "rival" });
  });
});

describe("applyDirectorNotesPatch", () => {
  it("replaces a present field entirely", () => {
    // arrange
    const base = { ...initialDirectorNotes(), tempo: "normal" as const };
    const patch = { tempo: "fast" as const };

    // act
    const result = applyDirectorNotesPatch(base, patch);

    // assert
    expect(result.tempo).toBe("fast");
  });

  it("leaves a field untouched when absent from the patch", () => {
    // arrange
    const base = { ...initialDirectorNotes(), energy: "peak" as const };
    const patch = { tempo: "fast" as const };

    // act
    const result = applyDirectorNotesPatch(base, patch);

    // assert
    expect(result.energy).toBe("peak");
  });

  it("replaces stagnation_count with an explicit zero rather than treating it as absent", () => {
    // arrange
    const base = { ...initialDirectorNotes(), stagnation_count: 3 };
    const patch = { stagnation_count: 0 };

    // act
    const result = applyDirectorNotesPatch(base, patch);

    // assert
    expect(result.stagnation_count).toBe(0);
  });
});
