import type OpenAI from "openai";
import {
  generateAudiencePrompt,
  type AudiencePromptProgressReporter,
  type AudiencePromptResult,
  type RandomSource,
  type WordSource,
} from "./audiencePrompt.js";
import type { AudiencePromptTypeId } from "./audiencePromptTypes.js";
import { selectSceneSetup } from "./director.js";
import type { DirectorSceneSetup, DirectorSceneSetupCandidate } from "./schemas.js";
import type { SceneConfig } from "./sceneConfig.js";

const DEFAULT_CHARACTER_COUNT = 2;
const DEFAULT_MAXIMUM_TURNS = 24;

export const sceneSetupSuggestionCounts = {
  location: 3,
  item: 3,
  challenge: 3,
  complication: 3,
  character: 6,
} as const satisfies Partial<Record<AudiencePromptTypeId, number>>;

export interface SceneSetupCandidate extends DirectorSceneSetupCandidate {
  promptType: AudiencePromptTypeId;
  seedWords: string[];
  association: string;
  rationale: string;
}

export interface SelectedScenePrompts {
  location: string;
  item: string;
  challenge: string;
  complication: string;
  characters: [string, string];
}

export interface GeneratedSceneSetup {
  candidates: SceneSetupCandidate[];
  selection: DirectorSceneSetup;
  selectedPrompts: SelectedScenePrompts;
}

type GenerateAudiencePromptFn = typeof generateAudiencePrompt;
type SelectSceneSetupFn = typeof selectSceneSetup;

export function buildSceneOpeningPrompt(selected: SelectedScenePrompts): string {
  return [
    `Location: ${selected.location}`,
    `Item: ${selected.item}`,
    `Challenge: ${selected.challenge}`,
    `Complication: ${selected.complication}`,
    "Characters:",
    `- Actor 1: ${selected.characters[0]}`,
    `- Actor 2: ${selected.characters[1]}`,
  ].join("\n");
}

function buildActorCharacterSeed(role: string, actorNumber: number): string {
  return `Audience character/role suggestion for Actor ${actorNumber}: ${role}.

Use this as your character seed, not a fixed biography. Decide who you are through play, and infer
who the other actor might be only from the opening prompts and the public transcript. You do not
receive the director's notes or the other actor's private memory.`;
}

export function buildSceneConfigFromSetup(
  setup: GeneratedSceneSetup,
  maximumTurns = DEFAULT_MAXIMUM_TURNS,
): SceneConfig {
  const [firstCharacter, secondCharacter] = setup.selectedPrompts.characters;
  return {
    participants: [
      {
        id: "actor_1",
        kind: "ai",
        displayName: "Actor 1",
        character: buildActorCharacterSeed(firstCharacter, 1),
      },
      {
        id: "actor_2",
        kind: "ai",
        displayName: "Actor 2",
        character: buildActorCharacterSeed(secondCharacter, 2),
      },
    ],
    openingPrompt: buildSceneOpeningPrompt(setup.selectedPrompts),
    maximumTurns,
    scriptedTurnsByParticipantId: new Map(),
  };
}

function getCandidateById(
  candidatesById: Map<string, SceneSetupCandidate>,
  id: string,
): SceneSetupCandidate {
  const candidate = candidatesById.get(id);
  if (!candidate) {
    throw new Error(`director selected unknown setup candidate id "${id}"`);
  }
  return candidate;
}

function buildSelectedPrompts(
  candidates: SceneSetupCandidate[],
  selection: DirectorSceneSetup,
): SelectedScenePrompts {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return {
    location: getCandidateById(candidatesById, selection.location).suggestion,
    item: getCandidateById(candidatesById, selection.item).suggestion,
    challenge: getCandidateById(candidatesById, selection.challenge).suggestion,
    complication: getCandidateById(candidatesById, selection.complication).suggestion,
    characters: [
      getCandidateById(candidatesById, selection.characters[0]!).suggestion,
      getCandidateById(candidatesById, selection.characters[1]!).suggestion,
    ],
  };
}

function buildCandidate(
  promptType: AudiencePromptTypeId,
  index: number,
  result: AudiencePromptResult,
): SceneSetupCandidate {
  return {
    id: `${promptType}-${index}`,
    promptType,
    type: result.type,
    suggestion: result.suggestion,
    seedWords: result.seedWords,
    association: result.association,
    rationale: result.rationale,
  };
}

export async function generateSceneSetup(
  client: OpenAI,
  model: string,
  params: {
    wordSource?: WordSource;
    random?: RandomSource;
    aiLogPath?: string;
    aiFullLogPath?: string;
    onProgress?: AudiencePromptProgressReporter;
    audiencePromptGenerator?: GenerateAudiencePromptFn;
    directorSetupSelector?: SelectSceneSetupFn;
    characterCount?: number;
  } = {},
): Promise<GeneratedSceneSetup> {
  const report = params.onProgress ?? (() => {});
  const audiencePromptGenerator = params.audiencePromptGenerator ?? generateAudiencePrompt;
  const directorSetupSelector = params.directorSetupSelector ?? selectSceneSetup;
  const characterCount = params.characterCount ?? DEFAULT_CHARACTER_COUNT;
  const requestedTypes = [
    "location",
    "item",
    "challenge",
    "complication",
    "character",
  ] as const satisfies AudiencePromptTypeId[];

  const candidates: SceneSetupCandidate[] = [];
  for (const promptType of requestedTypes) {
    const count =
      promptType === "character" ? characterCount * 3 : sceneSetupSuggestionCounts[promptType];
    for (let index = 1; index <= count; index += 1) {
      report(`Generating ${promptType} suggestion ${index}/${count}`);
      const result = await audiencePromptGenerator(client, model, {
        promptType,
        wordSource: params.wordSource,
        random: params.random,
        aiLogPath: params.aiLogPath,
        aiFullLogPath: params.aiFullLogPath,
        onProgress: (message) => report(`${promptType}-${index}: ${message}`),
      });
      candidates.push(buildCandidate(promptType, index, result));
    }
  }

  report("Asking director to choose a playable scene setup from audience suggestions");
  const selection = await directorSetupSelector(client, model, {
    candidates,
    characterCount,
    aiLogPath: params.aiLogPath,
    aiFullLogPath: params.aiFullLogPath,
  });

  return {
    candidates,
    selection,
    selectedPrompts: buildSelectedPrompts(candidates, selection),
  };
}
