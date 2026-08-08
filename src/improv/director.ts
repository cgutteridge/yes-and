import type OpenAI from "openai";
import { runJsonQuery } from "../services/jsonQueryService.js";
import { logger } from "../utils/logger.js";
import { applyDirectorNotesPatch } from "./notes.js";
import {
  buildDirectorNotesUpdatePrompt,
  buildDirectorSelectionPrompt,
  type DirectorParticipant,
} from "./prompts.js";
import {
  buildDirectorSelectionSchema,
  directorNotesPatchSchema,
  type DirectorNotes,
} from "./schemas.js";

export async function updateDirectorNotes(
  client: OpenAI,
  model: string,
  params: {
    notes: DirectorNotes;
    transcript: string;
    participants: DirectorParticipant[];
    maximumTurns: number;
    aiLogPath?: string;
  },
): Promise<DirectorNotes> {
  // maxAttempts: 3, not the default 2 -- a real scene run surfaced a
  // schema-validation failure (a performer's turn-plan call) that still
  // hadn't self-corrected after 2 attempts. Applied to every structured
  // call in the improv system, not just the one that failed.
  const prompt = buildDirectorNotesUpdatePrompt(params);
  const patch = await runJsonQuery(client, directorNotesPatchSchema, prompt, {
    model,
    maxAttempts: 3,
    operation: "scene:director-notes",
    aiLogPath: params.aiLogPath,
  });
  return applyDirectorNotesPatch(params.notes, patch);
}

/** Returns a participant id, or the literal string "END". */
export async function selectNextParticipant(
  client: OpenAI,
  model: string,
  params: {
    notes: DirectorNotes;
    transcript: string;
    participants: DirectorParticipant[];
    maximumTurns: number;
    turnsSoFar: number;
    aiLogPath?: string;
  },
): Promise<string> {
  const schema = buildDirectorSelectionSchema(
    params.participants.map((participant) => participant.id),
  );
  const prompt = buildDirectorSelectionPrompt(params);
  const selection = await runJsonQuery(client, schema, prompt, {
    model,
    maxAttempts: 3,
    operation: "scene:director-selection",
    aiLogPath: params.aiLogPath,
  });

  // A private diagnostic only -- never surfaced to a performer or the transcript.
  if (selection.reason) {
    logger.debug(`director reason: ${selection.reason}`);
  }

  return selection.next;
}
