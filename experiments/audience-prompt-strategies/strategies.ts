import type OpenAI from "openai";
import { runJsonQuery } from "../../src/services/jsonQueryService.js";
import {
  audienceAssociationSchema,
  audienceThoughtSchema,
  buildAudienceSuggestionSchema,
  countWords,
} from "../../src/improv/schemas.js";
import {
  buildAudienceAssociationPrompt,
  buildAudienceSuggestionPrompt,
  buildAudienceSystemPrompt,
  buildAudienceThoughtPrompt,
} from "../../src/improv/prompts.js";
import type { AudiencePromptTypeDefinition } from "../../src/improv/audiencePromptTypes.js";
import {
  buildCollapsedSuggestionPrompt,
  buildDecoupledAssociationPrompt,
  buildGroundedAssociationPrompt,
  buildPopCultureAssertedSuggestionPrompt,
  buildPopCultureLeaningSuggestionPrompt,
} from "./experimentalPrompts.js";
import { rollPopCultureSteer, type PopCultureRollResult } from "./popCultureSteer.js";

const AUDIENCE_PROMPT_TEMPERATURE = 1.5;
/** Default chance of pushing for a pop-culture reference in runTwoStepPopCultureSteer, given at
 * least one eligible seed word was drawn. Tune here rather than at call sites. */
const DEFAULT_POP_CULTURE_PROBABILITY = 0.3;

export interface StrategyContext {
  client: OpenAI;
  model: string;
  /** Every call is logged here so raw request/response payloads stay inspectable after the run. */
  aiFullLogPath: string;
}

export interface StrategyResult {
  strategy: string;
  calls: number;
  elapsedMs: number;
  /** Named intermediate artifacts, e.g. { thought, association } or { grounded }. Empty for the 1-step collapse. */
  stages: Record<string, string>;
  type: string;
  suggestion: string;
  rationale: string;
  wordCount: number;
  error?: string;
  /** Only set by runTwoStepPopCultureSteer: whether a pop-culture push was available/used this run. */
  popCultureRoll?: PopCultureRollResult;
}

const systemInstructions = buildAudienceSystemPrompt();

/** Faithful reconstruction of generateAudiencePrompt's call structure (same prompts, same
 * schemas, imported directly) but parameterized on already-resolved seed words, so the same
 * seed triple can be replayed across all three depths for a fair comparison. */
export async function runThreeStep(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  strategy: string,
): Promise<StrategyResult> {
  const start = Date.now();

  const thought = await runJsonQuery(
    ctx.client,
    audienceThoughtSchema,
    buildAudienceThoughtPrompt({ seedWords }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:thought`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  const association = await runJsonQuery(
    ctx.client,
    audienceAssociationSchema,
    buildAudienceAssociationPrompt({ thought: thought.thought }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:association`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestion = await runJsonQuery(
    ctx.client,
    suggestionSchema,
    buildAudienceSuggestionPrompt({ association: association.association, promptType }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:suggestion`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  return {
    strategy,
    calls: 3,
    elapsedMs: Date.now() - start,
    stages: { thought: thought.thought, association: association.association },
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
    wordCount: countWords(suggestion.suggestion),
  };
}

/** Merges the thought + association stages into one "grounded association" call, then reuses
 * the real, unmodified suggestion prompt/schema. */
export async function runTwoStep(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  strategy: string,
): Promise<StrategyResult> {
  const start = Date.now();

  const grounded = await runJsonQuery(
    ctx.client,
    audienceAssociationSchema,
    buildGroundedAssociationPrompt({ seedWords }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:grounded`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestion = await runJsonQuery(
    ctx.client,
    suggestionSchema,
    buildAudienceSuggestionPrompt({ association: grounded.association, promptType }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:suggestion`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  return {
    strategy,
    calls: 2,
    elapsedMs: Date.now() - start,
    stages: { grounded: grounded.association },
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
    wordCount: countWords(suggestion.suggestion),
  };
}

/** Same 2-step shape as runTwoStep, but the grounding stage explicitly does NOT require the
 * daydream to connect to the seed words -- see buildDecoupledAssociationPrompt's doc comment for
 * the measurement that motivated this. The suggestion stage is untouched: same real production
 * prompt as every other strategy here, so "does it still stay plain/on-type" is a fair test. */
export async function runDecoupledTwoStep(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  strategy: string,
): Promise<StrategyResult> {
  const start = Date.now();

  const grounded = await runJsonQuery(
    ctx.client,
    audienceAssociationSchema,
    buildDecoupledAssociationPrompt({ seedWords }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:grounded`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestion = await runJsonQuery(
    ctx.client,
    suggestionSchema,
    buildAudienceSuggestionPrompt({ association: grounded.association, promptType }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:suggestion`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  return {
    strategy,
    calls: 2,
    elapsedMs: Date.now() - start,
    stages: { grounded: grounded.association },
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
    wordCount: countWords(suggestion.suggestion),
  };
}

/** Same 2-step shape as runTwoStep, but the suggestion stage uses
 * buildPopCultureLeaningSuggestionPrompt (soft permission) instead of the real production prompt.
 *
 * MEASURED RESULT: 0/24 across three wordings of the permission -- see that prompt's doc comment.
 * Kept for the record; runTwoStepPopCultureSteer below is the version that actually moves the
 * rate, by deciding "sometimes" in code instead of asking the model to. */
export async function runTwoStepPopLeaning(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  strategy: string,
): Promise<StrategyResult> {
  const start = Date.now();

  const grounded = await runJsonQuery(
    ctx.client,
    audienceAssociationSchema,
    buildGroundedAssociationPrompt({ seedWords }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:grounded`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestion = await runJsonQuery(
    ctx.client,
    suggestionSchema,
    buildPopCultureLeaningSuggestionPrompt({ association: grounded.association, promptType }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:suggestion`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  return {
    strategy,
    calls: 2,
    elapsedMs: Date.now() - start,
    stages: { grounded: grounded.association },
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
    wordCount: countWords(suggestion.suggestion),
  };
}

/**
 * Same 2-step shape again, but "sometimes" is decided in code, not by the model: after grounding,
 * roll whether to push for a pop-culture reference (only possible when a drawn seed word actually
 * is one -- see rollPopCultureSteer). On a hit, the suggestion call uses
 * buildPopCultureAssertedSuggestionPrompt, which requires the reference rather than merely
 * permitting it, since a permission alone was measured to have zero effect. On a miss (no eligible
 * seed, or the roll didn't land), falls back to the real, unmodified production suggestion prompt
 * -- identical behavior to runTwoStep in that branch.
 *
 * popCultureEntries: load once via loadPopCultureEntries() and reuse across calls rather than
 * re-reading the word bank file per draw. probability/random are overridable for tuning and tests.
 */
export async function runTwoStepPopCultureSteer(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  strategy: string,
  popCultureEntries: Set<string>,
  probability: number = DEFAULT_POP_CULTURE_PROBABILITY,
  random: () => number = Math.random,
): Promise<StrategyResult> {
  const start = Date.now();

  const grounded = await runJsonQuery(
    ctx.client,
    audienceAssociationSchema,
    buildGroundedAssociationPrompt({ seedWords }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:grounded`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  const roll = rollPopCultureSteer(seedWords, popCultureEntries, probability, random);
  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestionPrompt = roll.triggered
    ? buildPopCultureAssertedSuggestionPrompt({
        association: grounded.association,
        promptType,
        targetReferences: roll.targets,
      })
    : buildAudienceSuggestionPrompt({ association: grounded.association, promptType });

  const suggestion = await runJsonQuery(ctx.client, suggestionSchema, suggestionPrompt, {
    model: ctx.model,
    maxAttempts: 3,
    operation: `experiment:${strategy}:suggestion${roll.triggered ? ":asserted" : ""}`,
    aiFullLogPath: ctx.aiFullLogPath,
    systemInstructions,
    temperature: AUDIENCE_PROMPT_TEMPERATURE,
  });

  return {
    strategy,
    calls: 2,
    elapsedMs: Date.now() - start,
    stages: { grounded: grounded.association },
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
    wordCount: countWords(suggestion.suggestion),
    popCultureRoll: roll,
  };
}

/** Full collapse: seed words straight to the typed suggestion in one call. */
export async function runOneStep(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  strategy: string,
): Promise<StrategyResult> {
  const start = Date.now();

  const suggestionSchema = buildAudienceSuggestionSchema(promptType.id);
  const suggestion = await runJsonQuery(
    ctx.client,
    suggestionSchema,
    buildCollapsedSuggestionPrompt({ seedWords, promptType }),
    {
      model: ctx.model,
      maxAttempts: 3,
      operation: `experiment:${strategy}:suggestion`,
      aiFullLogPath: ctx.aiFullLogPath,
      systemInstructions,
      temperature: AUDIENCE_PROMPT_TEMPERATURE,
    },
  );

  return {
    strategy,
    calls: 1,
    elapsedMs: Date.now() - start,
    stages: {},
    type: suggestion.type,
    suggestion: suggestion.suggestion,
    rationale: suggestion.rationale,
    wordCount: countWords(suggestion.suggestion),
  };
}

/** Runs a depth strategy but never throws -- a schema/API failure on one grid cell shouldn't
 * abort the rest of the experiment. The failure is recorded on the result instead. */
export async function safeRun(
  run: () => Promise<StrategyResult>,
  strategy: string,
): Promise<StrategyResult> {
  try {
    return await run();
  } catch (error) {
    return {
      strategy,
      calls: 0,
      elapsedMs: 0,
      stages: {},
      type: "",
      suggestion: "",
      rationale: "",
      wordCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
