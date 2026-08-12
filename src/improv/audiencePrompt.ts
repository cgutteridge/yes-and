import { readFile } from "node:fs/promises";
import type OpenAI from "openai";
import { runJsonQuery } from "../services/jsonQueryService.js";
import {
  audienceAssociationSchema,
  audienceThoughtSchema,
  buildAudienceSuggestionSchema,
  type AudienceAssociation,
  type AudienceSuggestion,
  type AudienceThought,
} from "./schemas.js";
import {
  buildAudienceAssociationPrompt,
  buildAudienceSuggestionPrompt,
  buildAudienceSystemPrompt,
  buildAudienceThoughtPrompt,
} from "./prompts.js";
import { audiencePromptTypes, type AudiencePromptTypeId } from "./audiencePromptTypes.js";

const DEFAULT_DICTIONARY_PATH = "/usr/share/dict/words";
const SOURCE_WORD_COUNT = 3;
const AUDIENCE_PROMPT_TEMPERATURE = 1.5;

export interface WordSource {
  loadWords(): Promise<string[]>;
}

export type RandomSource = () => number;
export type AudiencePromptProgressReporter = (message: string) => void;

export interface AudiencePromptResult {
  promptType: AudiencePromptTypeId;
  seedWords: string[];
  thought: string;
  association: string;
  type: AudiencePromptTypeId;
  suggestion: string;
  rationale: string;
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
    promptType: AudiencePromptTypeId;
    wordSource?: WordSource;
    random?: RandomSource;
    aiLogPath?: string;
    aiFullLogPath?: string;
    onProgress?: AudiencePromptProgressReporter;
  },
): Promise<AudiencePromptResult> {
  const report = params.onProgress ?? (() => {});
  const systemInstructions = buildAudienceSystemPrompt();
  const promptType = audiencePromptTypes[params.promptType];
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
      aiFullLogPath: params.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );
  report(`Internal dialogue: ${thought.thought}`);
  report("Translating the internal dialogue into an everyday association...");

  const associationPrompt = buildAudienceAssociationPrompt({ thought: thought.thought });
  const association: AudienceAssociation = await runJsonQuery(
    client,
    audienceAssociationSchema,
    associationPrompt,
    {
      model,
      maxAttempts: 3,
      operation: "audience-prompt:association",
      aiLogPath: params.aiLogPath,
      aiFullLogPath: params.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );
  report(`Everyday association: ${association.association}`);
  report(`Asking that simulated audience member for ${promptType.requestText}...`);

  const suggestionPrompt = buildAudienceSuggestionPrompt({
    association: association.association,
    promptType,
  });
  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestion: AudienceSuggestion = await runJsonQuery(
    client,
    suggestionSchema,
    suggestionPrompt,
    {
      model,
      maxAttempts: 3,
      operation: "audience-prompt:suggestion",
      aiLogPath: params.aiLogPath,
      aiFullLogPath: params.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );
  report(`Shouted suggestion: ${suggestion.suggestion}`);

  return {
    promptType: promptType.id,
    seedWords,
    thought: thought.thought,
    association: association.association,
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
  };
}
