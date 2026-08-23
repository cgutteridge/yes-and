import { describe, expect, it } from "vitest";
import {
  buildActorSystemPrompt,
  buildAudienceAssociationPrompt,
  buildAudienceGroundingPrompt,
  buildAudienceSystemPrompt,
  buildAudienceSuggestionPrompt,
  buildAudienceThoughtPrompt,
  buildDirectorNotesUpdatePrompt,
  buildDirectorSceneSetupPrompt,
  buildDirectorSelectionPrompt,
  buildPerformerNotesUpdatePrompt,
  buildPerformerPerformancePrompt,
  buildPerformerPlanPrompt,
} from "./prompts.js";
import { initialDirectorNotes, initialPerformerNotes } from "./notes.js";
import { audiencePromptTypes } from "./audiencePromptTypes.js";
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

describe("buildActorSystemPrompt", () => {
  it("frames the model as an actor focused on playable scene reality", () => {
    // act
    const prompt = buildActorSystemPrompt();

    // assert
    expect(prompt).toContain("AI actor");
    expect(prompt).toContain("Protect the scene's reality");
    expect(prompt).toContain("playable offers");
  });
});

describe("buildAudienceSystemPrompt", () => {
  it("frames the model as a quick ordinary audience member", () => {
    // act
    const prompt = buildAudienceSystemPrompt();

    // assert
    expect(prompt).toContain("ordinary audience member");
    expect(prompt).toContain("shouted off the top");
    expect(prompt).toMatch(/not\s+designed as a premise/);
  });
});

describe("buildAudienceThoughtPrompt", () => {
  it("includes all three seed words", () => {
    // arrange
    const seedWords = ["orchard", "tribunal", "velvet"];

    // act
    const prompt = buildAudienceThoughtPrompt({ seedWords });

    // assert
    expect(prompt).toContain('"orchard"');
    expect(prompt).toContain('"tribunal"');
    expect(prompt).toContain('"velvet"');
  });

  it("asks for an internal thought rather than an improv prompt", () => {
    // arrange
    const seedWords = ["kettle", "passport", "choir"];

    // act
    const prompt = buildAudienceThoughtPrompt({ seedWords });

    // assert
    expect(prompt).toContain("private internal dialogue");
    expect(prompt).toContain("should not already be an improv prompt");
  });
});

describe("buildAudienceGroundingPrompt", () => {
  it("includes all seed words", () => {
    // arrange
    const seedWords = ["orchard", "tribunal", "velvet"];

    // act
    const prompt = buildAudienceGroundingPrompt({ seedWords });

    // assert
    expect(prompt).toContain('"orchard"');
    expect(prompt).toContain('"tribunal"');
    expect(prompt).toContain('"velvet"');
  });

  it("treats the seed words as background noise the daydream is free to ignore", () => {
    // arrange
    const seedWords = ["kettle", "passport", "choir"];

    // act
    const prompt = buildAudienceGroundingPrompt({ seedWords });

    // assert -- guards against regressing to requiring a traceable connection: measured to
    // collapse onto a handful of repeated daydreams across independent draws, see prompts.ts.
    expect(prompt).toContain("background static");
    expect(prompt).toContain("does not\nneed to end up connected to any of them");
    expect(prompt).toContain("even if it lands somewhere with no obvious link back to the words");
  });
});

describe("buildAudienceAssociationPrompt", () => {
  it("asks for plain-language association from the private thought", () => {
    // arrange
    const thought = "The velvet judge would hate my orchard pie.";

    // act
    const prompt = buildAudienceAssociationPrompt({ thought });

    // assert
    expect(prompt).toContain(thought);
    expect(prompt).toContain("everyday association");
    expect(prompt).toContain("plain, common language");
    expect(prompt).toContain("Do not repeat obscure");
  });
});

describe("buildAudienceSuggestionPrompt", () => {
  it("includes the everyday association and requested prompt type", () => {
    // arrange
    const params = {
      association: "a brass band stuck in a car park",
      promptType: audiencePromptTypes.location,
    };

    // act
    const prompt = buildAudienceSuggestionPrompt(params);

    // assert
    expect(prompt).toContain(params.association);
    expect(prompt).toContain("for a location");
    expect(prompt).toContain("The answer must be a place");
    expect(prompt).toContain('type: exactly "location"');
    expect(prompt).toContain("suggestion: what the audience member shouts");
    expect(prompt).toContain("rationale: one concise sentence");
  });

  it("places the everyday association at the end so it is the last salient context", () => {
    // arrange
    const params = {
      association: "a brass band stuck in a car park",
      promptType: audiencePromptTypes.location,
    };

    // act
    const prompt = buildAudienceSuggestionPrompt(params);

    // assert
    expect(prompt).toContain("The last thing you think about before shouting your suggestion is:");
    expect(prompt.trim().endsWith(params.association)).toBe(true);
  });

  it("requires a very short shouted suggestion", () => {
    // arrange
    const params = {
      association: "a noisy office sink",
      promptType: audiencePromptTypes.item,
    };

    // act
    const prompt = buildAudienceSuggestionPrompt(params);

    // assert
    expect(prompt).toContain("The suggestion should be very short");
    expect(prompt).toContain("brief enough to be heard clearly");
  });

  it("pushes for a pithy blurted word or phrase over a written description", () => {
    // arrange
    const params = {
      association: "dust hit your curtain",
      promptType: audiencePromptTypes.complication,
    };

    // act
    const prompt = buildAudienceSuggestionPrompt(params);

    // assert -- guards against the model regressing to a literary description
    // like "a sudden fine layer of grit dusting everything" instead of a
    // blurted "unexpected grit" (see logs/ai-full.jsonl for the real example).
    expect(prompt).toContain("Shout the thing itself, not a description of it");
    expect(prompt).toContain("one to four words");
    expect(prompt).toContain('"unexpected grit"');
    expect(prompt).toContain("the pithy thing itself");
  });

  it("requires ordinary vocabulary even when the material above used a rarer word", () => {
    // arrange
    const params = {
      association: "wandering past the columbarium at the edge of the churchyard",
      promptType: audiencePromptTypes.location,
    };

    // act
    const prompt = buildAudienceSuggestionPrompt(params);

    // assert -- guards against an obscure seed/association word (e.g. "columbarium") surviving
    // verbatim into the suggestion instead of being translated to something an audience knows.
    expect(prompt).toContain("Keep the vocabulary itself ordinary");
    expect(prompt).toContain("immediately recognize");
    expect(prompt).toContain("Translate the idea behind an unfamiliar word");
  });
});

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

describe("buildDirectorSceneSetupPrompt", () => {
  it("asks the director to choose setup candidates by id", () => {
    // arrange
    const candidates = [
      { id: "location-1", type: "location" as const, suggestion: "a laundrette" },
      { id: "character-1", type: "character" as const, suggestion: "a landlord" },
    ];

    // act
    const prompt = buildDirectorSceneSetupPrompt({ candidates, characterCount: 2 });

    // assert
    expect(prompt).toContain("one location, one item, one challenge, one complication");
    expect(prompt).toContain("2 distinct");
    expect(prompt).toContain("Pick by candidate id only");
    expect(prompt).toContain('"id":"location-1"');
    expect(prompt).toContain("rationale is private");
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
