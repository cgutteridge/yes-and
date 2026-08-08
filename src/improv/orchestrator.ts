import type OpenAI from "openai";
import { selectNextParticipant, updateDirectorNotes } from "./director.js";
import { initialDirectorNotes, initialPerformerNotes } from "./notes.js";
import { takePerformerTurn } from "./performer.js";
import type { DirectorParticipant } from "./prompts.js";
import type { PerformerNotes } from "./schemas.js";
import type { SceneConfig } from "./sceneConfig.js";
import { appendTurn, renderTranscript } from "./transcript.js";
import type { Transcript, TranscriptEntry } from "./types.js";

export class ScriptedEntriesExhaustedError extends Error {}

export interface RunSceneResult {
  transcript: Transcript;
  endedBy: "director" | "turn_limit";
}

/**
 * The main loop (initial-plan.md §14). This is the one place allowed to
 * hold mutable per-scene state (notes, the scripted-turn cursors) and
 * coordinate the pure pieces in transcript.ts/notes.ts/prompts.ts and the
 * thin director.ts/performer.ts wrappers.
 */
export async function runScene(
  client: OpenAI,
  model: string,
  config: SceneConfig,
): Promise<RunSceneResult> {
  const participantById = new Map(
    config.participants.map((participant) => [participant.id, participant]),
  );
  const directorParticipants: DirectorParticipant[] = config.participants.map((participant) => ({
    id: participant.id,
    kind: participant.kind,
    displayName: participant.displayName,
  }));

  let transcript: Transcript = { openingPrompt: config.openingPrompt, turns: [] };
  let directorNotes = initialDirectorNotes();

  const performerNotesById = new Map<string, PerformerNotes>();
  for (const participant of config.participants) {
    if (participant.kind === "ai") {
      performerNotesById.set(participant.id, initialPerformerNotes());
    }
  }

  // Independent, mutable copies so shift()-ing here never mutates the
  // SceneConfig passed in, in case a caller reuses the same config across
  // scenes. The explicit return-type annotation matters: without it,
  // `[...turns]` infers as a readonly array (surprising, since nothing
  // here is written `as const`) and loses `.shift()`.
  const remainingScriptedTurnsById = new Map<string, TranscriptEntry[][]>(
    Array.from(
      config.scriptedTurnsByParticipantId,
      ([id, turns]): [string, TranscriptEntry[][]] => [id, [...turns]],
    ),
  );

  for (;;) {
    // Hard backstop: initial-plan.md §8 frames maximum_turns as a soft
    // signal the director should honor via prompt, with no explicit check
    // in §14's own pseudocode. Relying solely on the model to self-limit
    // is a real risk against a real paid API.
    if (transcript.turns.length >= config.maximumTurns) {
      return { transcript, endedBy: "turn_limit" };
    }

    const renderedTranscript = renderTranscript(transcript, config.participants);

    directorNotes = await updateDirectorNotes(client, model, {
      notes: directorNotes,
      transcript: renderedTranscript,
      participants: directorParticipants,
      maximumTurns: config.maximumTurns,
    });

    const next = await selectNextParticipant(client, model, {
      notes: directorNotes,
      transcript: renderedTranscript,
      participants: directorParticipants,
      maximumTurns: config.maximumTurns,
      turnsSoFar: transcript.turns.length,
    });

    if (next === "END") {
      return { transcript, endedBy: "director" };
    }

    const participant = participantById.get(next);
    if (!participant) {
      // Shouldn't happen: buildDirectorSelectionSchema constrains `next`
      // to the configured participant ids or "END". Guard anyway rather
      // than silently proceeding with undefined.
      throw new Error(`director selected unknown participant id "${next}"`);
    }

    if (participant.kind === "human") {
      const remaining = remainingScriptedTurnsById.get(participant.id) ?? [];
      const nextEntries = remaining.shift();
      if (!nextEntries) {
        throw new ScriptedEntriesExhaustedError(
          `participant "${participant.id}" was selected but has no scripted turns left`,
        );
      }
      transcript = appendTurn(transcript, participant.id, nextEntries);
      continue;
    }

    // AI performer. No notes-update call is ever made on the human branch
    // above -- permanent by design (§14's pseudocode has no such step
    // there), not something deferred for later.
    if (participant.character === undefined) {
      throw new Error(
        `participant "${participant.id}" has kind "ai" but no character definition ` +
          "(this should have been caught by scene-config validation)",
      );
    }
    const notes = performerNotesById.get(participant.id) ?? initialPerformerNotes();
    const result = await takePerformerTurn(client, model, {
      character: participant.character,
      notes,
      transcript: renderedTranscript,
    });
    performerNotesById.set(participant.id, result.notes);
    transcript = appendTurn(transcript, participant.id, result.performance.entries);
  }
}
