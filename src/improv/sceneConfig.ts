import fs from "node:fs";
import { z } from "zod";
import { transcriptEntrySchema } from "./schemas.js";
import type { Participant, TranscriptEntry } from "./types.js";

export class SceneConfigError extends Error {}

/**
 * On-disk shape, snake_case throughout to match initial-plan.md §2A's
 * literal example. Deliberately accepts the full configurability matrix
 * (all 5 opening_prompt_modes, all 3 actor_deliberation_modes) at the
 * schema level so an unsupported value fails with a specific, named
 * SceneConfigError below rather than a generic parse error -- this is the
 * documented seam for the deferred modes.
 */
const sceneConfigFileSchema = z.object({
  participants: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .regex(/^[a-zA-Z0-9_-]+$/, "must contain only letters, digits, underscores, and hyphens"),
        kind: z.enum(["human", "ai"]),
        display_name: z.string().min(1),
        character: z.string().optional(),
        scripted_turns: z.array(z.array(transcriptEntrySchema).min(1)).optional(),
      }),
    )
    .min(1),
  opening_prompt_mode: z.enum(["audience", "generated", "hybrid", "bare_suggestion", "none"]),
  opening_prompt: z.string().optional(),
  actor_deliberation_mode: z.enum(["off", "single_stage", "two_stage"]),
  maximum_turns: z.number().int().positive().max(200),
});

export interface SceneConfig {
  participants: Participant[];
  openingPrompt: string | undefined;
  maximumTurns: number;
  scriptedTurnsByParticipantId: Map<string, TranscriptEntry[][]>;
}

/**
 * Parses and validates a scene-config file's already-JSON.parse'd
 * content. Pure -- no filesystem access -- so it's directly testable with
 * plain objects, mirroring loadConfig(env)'s injectable-parameter pattern
 * in ../config/env.ts.
 */
export function parseSceneConfig(raw: unknown): SceneConfig {
  const parsed = sceneConfigFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new SceneConfigError(["Invalid scene configuration:", ...issues].join("\n"));
  }
  const data = parsed.data;

  if (data.opening_prompt_mode !== "audience") {
    throw new SceneConfigError(
      `opening_prompt_mode "${data.opening_prompt_mode}" is not implemented in this slice -- only "audience" is supported.`,
    );
  }
  if (data.actor_deliberation_mode !== "two_stage") {
    throw new SceneConfigError(
      `actor_deliberation_mode "${data.actor_deliberation_mode}" is not implemented in this slice -- only "two_stage" is supported.`,
    );
  }
  if (!data.opening_prompt || data.opening_prompt.trim() === "") {
    throw new SceneConfigError(
      'opening_prompt is required and must be non-empty when opening_prompt_mode is "audience".',
    );
  }

  const seenIds = new Set<string>();
  for (const participant of data.participants) {
    if (participant.id === "END") {
      throw new SceneConfigError(
        'participant id "END" is reserved (it collides with the director\'s END sentinel) and cannot be used.',
      );
    }
    if (seenIds.has(participant.id)) {
      throw new SceneConfigError(
        `duplicate participant id "${participant.id}" -- participant ids must be unique.`,
      );
    }
    seenIds.add(participant.id);

    if (
      participant.kind === "ai" &&
      (!participant.character || participant.character.trim() === "")
    ) {
      throw new SceneConfigError(
        `participant "${participant.id}" has kind "ai" but no character definition.`,
      );
    }
    if (
      participant.kind === "human" &&
      (!participant.scripted_turns || participant.scripted_turns.length === 0)
    ) {
      throw new SceneConfigError(
        `participant "${participant.id}" has kind "human" but no scripted_turns -- ` +
          "this slice's human input is scripted, not live.",
      );
    }
  }

  const participants: Participant[] = data.participants.map((participant) => ({
    id: participant.id,
    kind: participant.kind,
    displayName: participant.display_name,
    character: participant.character,
  }));

  const scriptedTurnsByParticipantId = new Map<string, TranscriptEntry[][]>();
  for (const participant of data.participants) {
    if (participant.scripted_turns) {
      scriptedTurnsByParticipantId.set(participant.id, participant.scripted_turns);
    }
  }

  return {
    participants,
    openingPrompt: data.opening_prompt,
    maximumTurns: data.maximum_turns,
    scriptedTurnsByParticipantId,
  };
}

export function loadSceneConfigFromFile(filePath: string): SceneConfig {
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return parseSceneConfig(raw);
}
