/**
 * Internal domain types for the improv orchestration engine. These are
 * constructed and consumed entirely by application code, never parsed
 * from untrusted input directly — so they're plain interfaces, not Zod
 * schemas. (Contrast with schemas.ts, which validates everything a model
 * or an on-disk file produces.)
 *
 * Field naming here is camelCase, matching the existing convention for
 * purely-internal runtime types (see AppConfig in ../config/env.ts, whose
 * apiKey/baseUrl are camelCase despite the AI_API_KEY/AI_BASE_URL env vars
 * they're parsed from).
 */

export type ParticipantKind = "human" | "ai";

export interface Participant {
  id: string;
  kind: ParticipantKind;
  displayName: string;
  /** Required for kind "ai", unused for kind "human" — enforced in sceneConfig.ts. */
  character: string | undefined;
}

export interface TranscriptEntry {
  type: "dialogue" | "action";
  text: string;
}

export interface TranscriptTurn {
  turn: number;
  participantId: string;
  entries: TranscriptEntry[];
}

export interface Transcript {
  openingPrompt: string | undefined;
  turns: TranscriptTurn[];
}
