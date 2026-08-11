import type { DirectorNotes, Performance, PerformerNotes, TurnPlan } from "./schemas.js";
import type { Participant } from "./types.js";

/**
 * Only the fields the director is ever allowed to read about a
 * participant (initial-plan.md §3: the director never reads character
 * definitions). This is a naming/lint-level hint, not the actual
 * enforcement -- see sanitizeParticipant below for why.
 */
export type DirectorParticipant = Pick<Participant, "id" | "kind" | "displayName">;

/**
 * TypeScript's excess-property check only fires on object literals passed
 * directly at a call site -- it does nothing when a caller holds a full
 * Participant[] (with `character` already on each object) in a variable
 * and passes that where DirectorParticipant[] is expected, which is
 * exactly what the orchestrator does. Explicitly picking fields here,
 * rather than trusting the parameter type, is the actual mechanism that
 * keeps `character` out of anything the director-facing prompts
 * serialize.
 */
function sanitizeParticipant(participant: DirectorParticipant): DirectorParticipant {
  return { id: participant.id, kind: participant.kind, displayName: participant.displayName };
}

export function buildActorSystemPrompt(): string {
  return `You are an AI actor in a turn-based improv practice scene.

Protect the scene's reality. Treat the public transcript as shared stage truth, respond only as
your own character, and make playable offers other actors can use. Prefer grounded reactions,
specificity, listening, and reincorporation over randomness, explanation, or trying to solve the
whole scene at once.`;
}

export function buildAudienceSystemPrompt(): string {
  return `You are simulating one ordinary audience member at a live improv show.

Think like a real person in a crowd: distracted, associative, specific, and quick rather than
carefully literary. Your suggestions should feel shouted off the top of someone's head, not
designed as a premise for the actors.`;
}

export function buildPerformerPlanPrompt(params: {
  character: string;
  notes: PerformerNotes;
  transcript: string;
}): string {
  return `You are one performer in a live, turn-based improvised scene.

You control only this character. The public transcript below is the only
communication between performers. Other performers cannot see your notes
or this private turn plan. You cannot see theirs or the director's
reasoning.

Your job is to respond truthfully as this character, notice and develop
offers, and leave other performers something playable. Help create the
conditions for comedy; do not try to make every turn a self-contained
joke. Character beliefs may differ from reality, other characters'
beliefs, and audience knowledge.

Future possibilities are provisional. Never force a payoff merely because
you imagined it. Follow what actually happens in the transcript.

If stuck, react to the last offer or use an established detail to invite
another performer to define more of the scene. Do not escape by adding
random novelty.

Create a concise private turn plan matching the required schema. This is
a short rationale, not an essay -- identify why a contribution may be
useful while treating future paths as optional. It is never shown to
anyone else.

The required top-level fields are exactly: current_read, purpose,
response_to, possible_continuations, commitment, confidence, mode. Include
all of them. When filling in the schema: use an empty string for response_to
if there is nothing yet in the transcript to respond to (for
example, the very first turn of a scene) -- never null. confidence must
be a plain number between 0 and 1 inclusive (0 = no confidence at all,
1 = fully confident) -- never negative, and never a string. mode must be
one of the schema's allowed strings -- never omit it.

Character definition:
${params.character}

Private notes:
${JSON.stringify(params.notes)}

Public transcript:
${params.transcript}`;
}

export function buildPerformerPerformancePrompt(params: {
  character: string;
  notes: PerformerNotes;
  transcript: string;
  plan: TurnPlan;
}): string {
  return `You are one performer in a live, turn-based improvised scene. You
control only this character, and you have already produced a private turn
plan for this moment (shown below). Now produce the observable public
performance that follows from it.

Make the smallest useful contribution. Usually produce one spoken
sentence or fragment of 2-12 words. Do not exceed 25 words unless this
particular moment clearly requires extended speech. Action is optional --
include it only when it changes what other characters can perceive or
respond to. Do not add routine gestures, expressions, movement or
delivery instructions. Never write another character's behaviour,
thoughts or reply. Do not explain your line's intention in public. Stop
after your contribution.

Your private turn plan and notes must never appear in the public
performance.

Character definition:
${params.character}

Private notes:
${JSON.stringify(params.notes)}

Private turn plan for this moment:
${JSON.stringify(params.plan)}

Public transcript:
${params.transcript}`;
}

export function buildPerformerNotesUpdatePrompt(params: {
  character: string;
  notes: PerformerNotes;
  transcript: string;
  plan: TurnPlan;
  performance: Performance;
}): string {
  return `You control this character in a turn-based improvised scene. You
have just made the public contribution shown below. Update your private
notes to reflect it.

Return only the fields that need to change, as a patch -- omit any field
that is unchanged. Distinguish fact from belief: you may know something
the audience has seen without your character knowing it. Retain useful
state, not a full history of reasoning; do not simply restate this turn's
plan back as notes.

Character definition:
${params.character}

Current private notes:
${JSON.stringify(params.notes)}

Your turn plan this turn:
${JSON.stringify(params.plan)}

Your public performance this turn:
${JSON.stringify(params.performance)}

Public transcript so far:
${params.transcript}`;
}

export function buildDirectorNotesUpdatePrompt(params: {
  notes: DirectorNotes;
  transcript: string;
  participants: DirectorParticipant[];
  maximumTurns: number;
}): string {
  const participants = params.participants.map(sanitizeParticipant);
  return `You are the silent director of a turn-based improvised scene. You
do not write dialogue, action, plot instructions or suggestions -- you
only observe and update your private understanding of the scene so far.

Estimate what the audience knows, suspects and expects. Track focus,
rhythm, active patterns, unresolved offers, neglected participants,
potential payoffs, and stagnation. This is your own private model of the
scene, never shown to any performer.

Return only the fields that need to change, as a patch -- omit any field
that is unchanged.

Maximum turns for this scene: ${params.maximumTurns}

Participants:
${JSON.stringify(participants)}

Current private director notes:
${JSON.stringify(params.notes)}

Public transcript:
${params.transcript}`;
}

export function buildDirectorSelectionPrompt(params: {
  notes: DirectorNotes;
  transcript: string;
  participants: DirectorParticipant[];
  maximumTurns: number;
  turnsSoFar: number;
}): string {
  const participants = params.participants.map(sanitizeParticipant);
  return `You are the silent director of a turn-based improvised scene.
You do not write dialogue, action, plot instructions or suggestions. Your
sole influence is choosing which participant acts next, or ending the
scene.

Choose the participant whose opportunity to act is most likely to help
the scene now, while accepting that you cannot tell them what to do. Do
not select mechanically in round-robin order. Rapid exchanges will often
alternate between the relevant participants. You may select the same
participant twice when justified. Include human participants normally; do
not treat them as observers or reserve them only for punchlines.

End the scene (return "END") immediately when a strong button, reversal,
culmination or final image has just landed and another turn would
probably explain or weaken it. Also end if the scene has stagnated
despite attempts to change focus, or the turn limit below has been
reached or is about to be. Not every thread needs resolution.

You may keep a brief private reason for your choice -- it is never shown
to a performer or placed in the public transcript.

This scene has used ${params.turnsSoFar} of a maximum ${params.maximumTurns} turns.

Participants:
${JSON.stringify(participants)}

Private director notes:
${JSON.stringify(params.notes)}

Public transcript:
${params.transcript}`;
}

export function buildAudienceThoughtPrompt(params: { seedWords: string[] }): string {
  return `You are simulating the private internal dialogue of one ordinary audience member at a live improv or standup show.

The audience member has three unrelated words drifting through their mind.
Connect the words into one specific, natural-sounding thought they might be having right now.
The thought can be odd, distracted, personal or mundane, but it should not already be an improv prompt.

Return a concise thought matching the required schema.

Random words:
${JSON.stringify(params.seedWords)}`;
}

export function buildAudienceSuggestionPrompt(params: {
  thought: string;
  promptType: string;
}): string {
  return `You are attending a live improv show.

The performers ask the audience for a ${params.promptType}.
What do you shout out off the top of your head?

Respond with a very short audience suggestion matching the required schema.
It should be brief enough to be heard clearly by actors on stage.
Do not explain it, justify it or turn it into a full premise.

The last thing you think about before shouting your prompt idea is:
${params.thought}`;
}
