import type OpenAI from "openai";
import { runJsonQuery } from "../services/jsonQueryService.js";
import { applyPerformerNotesPatch } from "./notes.js";
import {
  buildPerformerNotesUpdatePrompt,
  buildPerformerPerformancePrompt,
  buildPerformerPlanPrompt,
} from "./prompts.js";
import {
  performanceSchema,
  performerNotesPatchSchema,
  turnPlanSchema,
  type Performance,
  type PerformerNotes,
  type TurnPlan,
} from "./schemas.js";

export interface PerformerTurnResult {
  plan: TurnPlan;
  performance: Performance;
  notes: PerformerNotes;
}

/**
 * Runs one AI performer's two_stage turn: a private plan (Stage A), the
 * public performance that follows from it (Stage B), then a private
 * notes-patch update reflecting what just happened (Stage C). Three
 * independent runJsonQuery calls -- each with its own schema and its own
 * retry loop, mirrored by director.ts's two-call split for the same
 * reason (a malformed later stage doesn't force redoing an
 * already-fine earlier one).
 */
export async function takePerformerTurn(
  client: OpenAI,
  model: string,
  params: {
    character: string;
    notes: PerformerNotes;
    transcript: string;
  },
): Promise<PerformerTurnResult> {
  // maxAttempts: 3, not the default 2 -- see director.ts's updateDirectorNotes for why.
  const planPrompt = buildPerformerPlanPrompt(params);
  const plan = await runJsonQuery(client, turnPlanSchema, planPrompt, { model, maxAttempts: 3 });

  const performancePrompt = buildPerformerPerformancePrompt({ ...params, plan });
  const performance = await runJsonQuery(client, performanceSchema, performancePrompt, {
    model,
    maxAttempts: 3,
  });

  const notesUpdatePrompt = buildPerformerNotesUpdatePrompt({ ...params, plan, performance });
  const patch = await runJsonQuery(client, performerNotesPatchSchema, notesUpdatePrompt, {
    model,
    maxAttempts: 3,
  });
  const notes = applyPerformerNotesPatch(params.notes, patch);

  return { plan, performance, notes };
}
