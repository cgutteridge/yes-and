import { z } from "zod";

/**
 * Model-I/O Zod schemas for the improv orchestration engine — everything a
 * model is asked to produce, validated the same way the pre-existing
 * generic CLI validates its own responses (see ../services/jsonQueryService.ts,
 * which every one of these schemas is designed to be used with via
 * runJsonQuery). Field names are snake_case throughout, matching
 * initial-plan.md's literal JSON shapes byte-for-byte — these are read and
 * authored directly by a model, unlike the camelCase internal types in
 * ./types.ts.
 */

const HARD_MAX_WORDS = 25;
const AUDIENCE_PROMPT_MAX_WORDS = 8;
const turnPlanModeSchema = z.enum([
  "react",
  "offer",
  "clarify",
  "escalate",
  "reincorporate",
  "payoff",
  "yield",
  "panic",
]);

/** Trimmed word count; "" and whitespace-only text both count as 0. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export const transcriptEntrySchema = z.object({
  type: z.enum(["dialogue", "action"]),
  text: z.string(),
});
export type TranscriptEntrySchemaType = z.infer<typeof transcriptEntrySchema>;

// initial-plan.md §5, Stage A: the private turn plan.
const turnPlanShape = z.object({
  current_read: z.string().min(1),
  purpose: z.string().min(1),
  response_to: z.string().default(""),
  possible_continuations: z.array(z.string()).max(5).default([]),
  commitment: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.5),
  mode: turnPlanModeSchema.default("react"),
});

function normalizeTurnPlanCandidate(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    normalized[key.trim()] = entryValue;
  }

  if (Array.isArray(normalized.possible_continuations)) {
    normalized.possible_continuations = normalized.possible_continuations.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  if (typeof normalized.mode === "string") {
    normalized.mode = normalized.mode.trim();
  }

  return normalized;
}

export const turnPlanSchema = z.preprocess(normalizeTurnPlanCandidate, turnPlanShape);
export type TurnPlan = z.infer<typeof turnPlanSchema>;

// initial-plan.md §5, Stage B: the public performance.
//
// z.toJSONSchema() (used by jsonQueryService's buildSystemPrompt) silently
// drops .refine()/.superRefine() checks when generating the JSON Schema
// shown to the model upfront -- so the checks below are a repair-loop
// backstop only, not something the model is told about in advance. The
// real upfront guidance for the word limit is the prose in prompts.ts
// (per §12's own template). Native .min()/.max() below ARE represented in
// the upfront schema with good default messages, so use those wherever a
// check is expressible that way.
export const performanceSchema = z
  .object({
    entries: z.array(transcriptEntrySchema).min(1).max(6),
  })
  .superRefine((value, ctx) => {
    const hasNonEmptyEntry = value.entries.some((entry) => entry.text.trim() !== "");
    if (!hasNonEmptyEntry) {
      ctx.addIssue({
        code: "custom",
        message: "At least one entry must contain non-whitespace text.",
        path: ["entries"],
      });
    }

    const totalWords = value.entries.reduce((sum, entry) => sum + countWords(entry.text), 0);
    if (totalWords > HARD_MAX_WORDS) {
      ctx.addIssue({
        code: "custom",
        message:
          `The turn contains ${totalWords} words across its entries, which exceeds the ` +
          `${HARD_MAX_WORDS}-word hard maximum. Shorten the text so the total is at most ` +
          `${HARD_MAX_WORDS} words.`,
        path: ["entries"],
      });
    }
  });
export type Performance = z.infer<typeof performanceSchema>;

// initial-plan.md §6: performer private notes.
export const performerNotesSchema = z.object({
  character_beliefs: z.array(z.string()),
  character_wants: z.array(z.string()),
  relationships: z.record(z.string(), z.string()),
  facts_known: z.array(z.string()),
  suspicions: z.array(z.string()),
  unresolved_offers: z.array(z.string()),
  promises_and_patterns: z.array(z.string()),
  possible_payoffs: z.array(z.string()),
  character_discoveries: z.array(z.string()),
  boundaries: z.array(z.string()),
  discarded_ideas: z.array(z.string()),
});
export type PerformerNotes = z.infer<typeof performerNotesSchema>;

export const performerNotesPatchSchema = performerNotesSchema.partial();
export type PerformerNotesPatch = z.infer<typeof performerNotesPatchSchema>;

// initial-plan.md §7: director private notes. "tempo"/"energy" are given
// example values ("normal"/"building") but no explicit enum list anywhere
// in the spec -- this closed set is an interpretation, not a spec quote.
export const directorNotesSchema = z.object({
  audience_knows: z.array(z.string()),
  audience_suspects: z.array(z.string()),
  audience_expects: z.array(z.string()),
  dramatic_ironies: z.array(z.string()),
  active_patterns: z.array(z.string()),
  open_questions: z.array(z.string()),
  focus_history: z.array(z.string()),
  tempo: z.enum(["slow", "normal", "fast"]),
  energy: z.enum(["building", "peak", "fading"]),
  ending_opportunities: z.array(z.string()),
  stagnation_count: z.number().int().min(0),
});
export type DirectorNotes = z.infer<typeof directorNotesSchema>;

export const directorNotesPatchSchema = directorNotesSchema.partial();
export type DirectorNotesPatch = z.infer<typeof directorNotesPatchSchema>;

/**
 * The director's selection is scene-specific (valid `next` values depend on
 * which participants exist in this scene), so it's a schema factory rather
 * than a static export. `reason` is a concise private diagnostic per
 * initial-plan.md §3/§18 -- it must never be shown to a performer or placed
 * in the transcript, only logger.debug'd.
 */
export function buildDirectorSelectionSchema(participantIds: string[]) {
  const [first, ...rest] = participantIds;
  if (first === undefined) {
    throw new Error("buildDirectorSelectionSchema requires at least one participant id");
  }
  return z.object({
    next: z.union([z.enum([first, ...rest]), z.literal("END")]),
    reason: z.string().optional(),
  });
}
export type DirectorSelection = z.infer<ReturnType<typeof buildDirectorSelectionSchema>>;

export const audienceThoughtSchema = z.object({
  thought: z.string().trim().min(1),
});
export type AudienceThought = z.infer<typeof audienceThoughtSchema>;

export const audienceSuggestionSchema = z
  .object({
    prompt: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    const totalWords = countWords(value.prompt);
    if (totalWords > AUDIENCE_PROMPT_MAX_WORDS) {
      ctx.addIssue({
        code: "custom",
        message:
          `The audience prompt contains ${totalWords} words, which exceeds the ` +
          `${AUDIENCE_PROMPT_MAX_WORDS}-word maximum. Shorten it so actors can hear it.`,
        path: ["prompt"],
      });
    }
  });
export type AudienceSuggestion = z.infer<typeof audienceSuggestionSchema>;
