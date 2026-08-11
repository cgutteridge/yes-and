import { readFile } from "node:fs/promises";
import type OpenAI from "openai";
import { runJsonQuery } from "../services/jsonQueryService.js";
import {
  audienceSuggestionSchema,
  audienceThoughtSchema,
  type AudienceSuggestion,
  type AudienceThought,
} from "./schemas.js";
import {
  buildAudienceSuggestionPrompt,
  buildAudienceSystemPrompt,
  buildAudienceThoughtPrompt,
} from "./prompts.js";

const DEFAULT_DICTIONARY_PATH = "/usr/share/dict/words";
const SOURCE_WORD_COUNT = 3;
const AUDIENCE_PROMPT_TEMPERATURE = 1.5;

export interface WordSource {
  loadWords(): Promise<string[]>;
}

export type RandomSource = () => number;
export type AudiencePromptProgressReporter = (message: string) => void;

export interface AudiencePromptResult {
  seedWords: string[];
  thought: string;
  prompt: string;
}

export class AudiencePromptError extends Error {}

export class DictionaryWordSource implements WordSource {
  constructor(private readonly path = DEFAULT_DICTIONARY_PATH) {}

  async loadWords(): Promise<string[]> {
    const content = await readFile(this.path, "utf8");
    return content
      .split(/\r?\n/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  }
}

export function selectRandomWords(
  words: string[],
  count = SOURCE_WORD_COUNT,
  random: RandomSource = Math.random,
): string[] {
  const uniqueWords = Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));
  if (uniqueWords.length < count) {
    throw new AudiencePromptError(
      `word source returned ${uniqueWords.length} usable word(s), but ${count} are required`,
    );
  }

  const pool = [...uniqueWords];
  const selected: string[] = [];
  while (selected.length < count) {
    const index = Math.floor(random() * pool.length);
    const [word] = pool.splice(index, 1);
    if (word === undefined) {
      throw new AudiencePromptError("random word selection failed unexpectedly");
    }
    selected.push(word);
  }

  return selected;
}

export async function generateAudiencePrompt(
  client: OpenAI,
  model: string,
  params: {
    promptType: string;
    wordSource?: WordSource;
    random?: RandomSource;
    aiLogPath?: string;
    onProgress?: AudiencePromptProgressReporter;
  },
): Promise<AudiencePromptResult> {
  const report = params.onProgress ?? (() => {});
  const systemInstructions = buildAudienceSystemPrompt();
  const wordSource = params.wordSource ?? new DictionaryWordSource();
  const seedWords = selectRandomWords(
    await wordSource.loadWords(),
    SOURCE_WORD_COUNT,
    params.random ?? Math.random,
  );
  report(`Seed words: ${seedWords.join(", ")}`);
  report("Connecting the seed words into one audience member's internal dialogue...");

  const thoughtPrompt = buildAudienceThoughtPrompt({ seedWords });
  const thought: AudienceThought = await runJsonQuery(
    client,
    audienceThoughtSchema,
    thoughtPrompt,
    {
      model,
      maxAttempts: 3,
      operation: "audience-prompt:thought",
      aiLogPath: params.aiLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );
  report(`Internal dialogue: ${thought.thought}`);
  report(`Asking that simulated audience member for a ${params.promptType}...`);

  const suggestionPrompt = buildAudienceSuggestionPrompt({
    thought: thought.thought,
    promptType: params.promptType,
  });
  const suggestion: AudienceSuggestion = await runJsonQuery(
    client,
    audienceSuggestionSchema,
    suggestionPrompt,
    {
      model,
      maxAttempts: 3,
      operation: "audience-prompt:suggestion",
      aiLogPath: params.aiLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );
  report(`Shouted prompt: ${suggestion.prompt}`);

  return {
    seedWords,
    thought: thought.thought,
    prompt: suggestion.prompt,
  };
}
