import { describe, expect, it } from "vitest";
import {
  AudiencePromptError,
  generateAudiencePrompt,
  selectRandomWords,
  type WordSource,
} from "./audiencePrompt.js";
import { fakeClient } from "./testing/fakeClient.js";

class StaticWordSource implements WordSource {
  constructor(private readonly words: string[]) {}

  async loadWords(): Promise<string[]> {
    return this.words;
  }
}

describe("selectRandomWords", () => {
  it("selects unique words using the supplied random source", () => {
    // arrange
    const words = ["apple", "brisket", "cello", "docket"];
    const values = [0, 0.5, 0.99];
    let index = 0;
    const random = () => values[index++] ?? 0;

    // act
    const result = selectRandomWords(words, 3, random);

    // assert
    expect(result).toEqual(["apple", "cello", "docket"]);
  });

  it("deduplicates and trims source words before selecting", () => {
    // arrange
    const words = [" apple ", "apple", "", "cello", "docket"];

    // act
    const result = selectRandomWords(words, 3, () => 0);

    // assert
    expect(result).toEqual(["apple", "cello", "docket"]);
  });

  it("throws when fewer than three usable words are available", () => {
    // arrange
    const words = ["apple", "apple", " "];

    // act & assert
    expect(() => selectRandomWords(words)).toThrow(AudiencePromptError);
  });
});

describe("generateAudiencePrompt", () => {
  it("connects three selected words into a thought, translates it, then asks for a shouted suggestion", async () => {
    // arrange
    const { client, create } = fakeClient(
      JSON.stringify({ thought: "The velvet judge would hate my orchard pie." }),
      JSON.stringify({ association: "a fancy courthouse picnic" }),
      JSON.stringify({
        type: "location",
        suggestion: "velvet courtroom",
        rationale: "It turns the courthouse picnic into a place.",
      }),
    );
    const progressMessages: string[] = [];

    // act
    const result = await generateAudiencePrompt(client, "test-model", {
      promptType: "location",
      wordSource: new StaticWordSource(["orchard", "tribunal", "velvet"]),
      random: () => 0,
      onProgress: (message) => progressMessages.push(message),
    });

    // assert
    expect(result).toEqual({
      promptType: "location",
      seedWords: ["orchard", "tribunal", "velvet"],
      thought: "The velvet judge would hate my orchard pie.",
      association: "a fancy courthouse picnic",
      type: "location",
      suggestion: "velvet courtroom",
      rationale: "It turns the courthouse picnic into a place.",
    });
    expect(create).toHaveBeenCalledTimes(3);
    const firstSystemPrompt = create.mock.calls[0]?.[0].messages[0].content as string;
    const thirdSystemPrompt = create.mock.calls[2]?.[0].messages[0].content as string;
    const firstPrompt = create.mock.calls[0]?.[0].messages[1].content as string;
    const secondPrompt = create.mock.calls[1]?.[0].messages[1].content as string;
    const thirdPrompt = create.mock.calls[2]?.[0].messages[1].content as string;
    expect(firstSystemPrompt).toContain("simulating one ordinary audience member");
    expect(firstSystemPrompt).toContain("Respond with a single JSON object only.");
    expect(thirdSystemPrompt).toContain("simulating one ordinary audience member");
    expect(create.mock.calls[0]?.[0]).toMatchObject({ temperature: 1.5 });
    expect(create.mock.calls[1]?.[0]).toMatchObject({ temperature: 1.5 });
    expect(create.mock.calls[2]?.[0]).toMatchObject({ temperature: 1.5 });
    expect(firstPrompt).toContain('"orchard"');
    expect(secondPrompt).toContain("The velvet judge would hate my orchard pie.");
    expect(secondPrompt).toContain("plain, common language");
    expect(thirdPrompt).toContain("a fancy courthouse picnic");
    expect(thirdPrompt).toContain("for a location");
    expect(thirdPrompt).toContain("The answer must be a place");
    expect(thirdPrompt).toContain('type: exactly "location"');
    expect(thirdPrompt).toContain("suggestion: what the audience member shouts");
    expect(thirdPrompt).toContain("rationale: one concise sentence");
    expect(progressMessages).toEqual([
      "Seed words: orchard, tribunal, velvet",
      "Connecting the seed words into one audience member's internal dialogue...",
      "Internal dialogue: The velvet judge would hate my orchard pie.",
      "Translating the internal dialogue into an everyday association...",
      "Everyday association: a fancy courthouse picnic",
      "Asking that simulated audience member for a location...",
      "Shouted suggestion: velvet courtroom",
    ]);
  });

  it("retries when the shouted suggestion is too long", async () => {
    // arrange
    const { client, create } = fakeClient(
      JSON.stringify({ thought: "I miss the old museum cloakroom." }),
      JSON.stringify({ association: "a museum cloakroom" }),
      JSON.stringify({
        type: "item",
        suggestion: "a museum cloakroom with far too many abandoned umbrellas",
        rationale: "It connects to the cloakroom and is an item.",
      }),
      JSON.stringify({
        type: "item",
        suggestion: "umbrella",
        rationale: "It comes from the cloakroom association and is an item.",
      }),
    );

    // act
    const result = await generateAudiencePrompt(client, "test-model", {
      promptType: "item",
      wordSource: new StaticWordSource(["museum", "cloakroom", "umbrella"]),
      random: () => 0,
    });

    // assert
    expect(result.suggestion).toBe("umbrella");
    expect(create).toHaveBeenCalledTimes(4);
  });
});
