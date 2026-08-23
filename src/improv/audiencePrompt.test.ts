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
  it("grounds the seed words into a daydream, then asks for a shouted suggestion", async () => {
    // arrange
    const { client, create } = fakeClient(
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
      association: "a fancy courthouse picnic",
      type: "location",
      suggestion: "velvet courtroom",
      rationale: "It turns the courthouse picnic into a place.",
    });
    expect(create).toHaveBeenCalledTimes(2);
    const firstSystemPrompt = create.mock.calls[0]?.[0].messages[0].content as string;
    const secondSystemPrompt = create.mock.calls[1]?.[0].messages[0].content as string;
    const firstPrompt = create.mock.calls[0]?.[0].messages[1].content as string;
    const secondPrompt = create.mock.calls[1]?.[0].messages[1].content as string;
    expect(firstSystemPrompt).toContain("simulating one ordinary audience member");
    expect(firstSystemPrompt).toContain("Respond with a single JSON object only.");
    expect(secondSystemPrompt).toContain("simulating one ordinary audience member");
    expect(create.mock.calls[0]?.[0]).toMatchObject({ temperature: 1.5 });
    expect(create.mock.calls[1]?.[0]).toMatchObject({ temperature: 1.5 });
    expect(firstPrompt).toContain('"orchard"');
    expect(firstPrompt).toContain("background static");
    expect(secondPrompt).toContain("a fancy courthouse picnic");
    expect(secondPrompt).toContain("for a location");
    expect(secondPrompt).toContain("The answer must be a place");
    expect(secondPrompt).toContain('type: exactly "location"');
    expect(secondPrompt).toContain("suggestion: what the audience member shouts");
    expect(secondPrompt).toContain("rationale: one concise sentence");
    expect(progressMessages).toEqual([
      "Seed words: orchard, tribunal, velvet",
      "Letting the seed words jostle one audience member's daydream...",
      "Daydream: a fancy courthouse picnic",
      "Asking that simulated audience member for a location...",
      "Shouted suggestion: velvet courtroom",
    ]);
  });

  it("retries when the shouted suggestion is too long", async () => {
    // arrange
    const { client, create } = fakeClient(
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
    expect(create).toHaveBeenCalledTimes(3);
  });
});
