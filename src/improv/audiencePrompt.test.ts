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
  it("connects three selected words into a thought, then asks for a shouted prompt", async () => {
    // arrange
    const { client, create } = fakeClient(
      JSON.stringify({ thought: "The velvet judge would hate my orchard pie." }),
      JSON.stringify({ prompt: "velvet courtroom" }),
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
      seedWords: ["orchard", "tribunal", "velvet"],
      thought: "The velvet judge would hate my orchard pie.",
      prompt: "velvet courtroom",
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
    expect(secondPrompt).toContain("The velvet judge would hate my orchard pie.");
    expect(secondPrompt).toContain("for a location");
    expect(progressMessages).toEqual([
      "Seed words: orchard, tribunal, velvet",
      "Connecting the seed words into one audience member's internal dialogue...",
      "Internal dialogue: The velvet judge would hate my orchard pie.",
      "Asking that simulated audience member for a location...",
      "Shouted prompt: velvet courtroom",
    ]);
  });

  it("retries when the shouted prompt is too long", async () => {
    // arrange
    const { client, create } = fakeClient(
      JSON.stringify({ thought: "I miss the old museum cloakroom." }),
      JSON.stringify({ prompt: "a museum cloakroom with far too many abandoned umbrellas" }),
      JSON.stringify({ prompt: "museum cloakroom" }),
    );

    // act
    const result = await generateAudiencePrompt(client, "test-model", {
      promptType: "object",
      wordSource: new StaticWordSource(["museum", "cloakroom", "umbrella"]),
      random: () => 0,
    });

    // assert
    expect(result.prompt).toBe("museum cloakroom");
    expect(create).toHaveBeenCalledTimes(3);
  });
});
