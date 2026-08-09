import type { Participant, Transcript, TranscriptEntry, TranscriptTurn } from "./types.js";

/**
 * Appends one turn to a transcript, returning a new Transcript rather than
 * mutating the input. This is the ONE place turn numbers get assigned —
 * callers never compute or pass a turn number themselves.
 */
export function appendTurn(
  transcript: Transcript,
  participantId: string,
  entries: TranscriptEntry[],
): Transcript {
  const turn: TranscriptTurn = {
    turn: transcript.turns.length + 1,
    participantId,
    entries,
  };
  return {
    openingPrompt: transcript.openingPrompt,
    turns: [...transcript.turns, turn],
  };
}

function stripWrappingPair(text: string, opening: string, closing: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith(opening) && trimmed.endsWith(closing) && trimmed.length >= 2) {
    return trimmed.slice(opening.length, -closing.length).trim();
  }
  return trimmed;
}

export function renderTranscriptEntry(entry: TranscriptEntry): string {
  if (entry.type === "dialogue") {
    const text = stripWrappingPair(stripWrappingPair(entry.text, '"', '"'), "'", "'");
    return `"${text}"`;
  }

  const text = stripWrappingPair(entry.text, "*", "*");
  return `*${text}*`;
}

export function renderTranscriptTurn(turn: TranscriptTurn, participants: Participant[]): string {
  const displayNameById = new Map(
    participants.map((participant) => [participant.id, participant.displayName]),
  );
  const displayName = displayNameById.get(turn.participantId) ?? turn.participantId;
  const rendered = turn.entries.map(renderTranscriptEntry).join(" ");
  return `${turn.turn}. ${displayName}: ${rendered}`;
}

/**
 * Renders a transcript into the plain-text form fed to every model prompt
 * (initial-plan.md §4: "render entries into a readable transcript for
 * model input"). The exact format isn't spec-mandated, so this is the one
 * place that convention is decided — every prompt builder in prompts.ts
 * depends on it, so a change here is a change to every model's context.
 */
export function renderTranscript(transcript: Transcript, participants: Participant[]): string {
  const lines: string[] = [];

  if (transcript.openingPrompt) {
    lines.push(`Opening prompt: ${transcript.openingPrompt}`);
  }

  for (const turn of transcript.turns) {
    lines.push(renderTranscriptTurn(turn, participants));
  }

  return lines.join("\n");
}
