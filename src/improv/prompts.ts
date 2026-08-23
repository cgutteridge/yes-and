import type {
  DirectorNotes,
  DirectorSceneSetupCandidate,
  Performance,
  PerformerNotes,
  TurnPlan,
} from "./schemas.js";
import type { Participant } from "./types.js";
import type { AudiencePromptTypeDefinition } from "./audiencePromptTypes.js";

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

export function buildDirectorSceneSetupPrompt(params: {
  candidates: DirectorSceneSetupCandidate[];
  characterCount: number;
}): string {
  return `You are the silent director setting up a turn-based improvised scene.

The audience has shouted several candidate suggestions. Choose the most usable setup for actors:
one location, one item, one challenge, one complication, and ${params.characterCount} distinct
character or role suggestions.

Pick by candidate id only. Prefer suggestions that are plain, playable, specific enough to start
from, and compatible without becoming a full plotted premise. The challenge should be something
characters can actively deal with. The complication should be an extra pressure or wrinkle that
can enter or color the scene. Character picks should be roles the actors can inhabit without
needing a biography.

Return a JSON response matching the required schema. The selected candidate ids will be shown to
the actors as the opening prompts; your rationale is private and is not shown to them.

Candidate suggestions:
${JSON.stringify(params.candidates)}`;
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

/**
 * Single-call replacement for the buildAudienceThoughtPrompt + buildAudienceAssociationPrompt
 * pair below: connects the seed words into one daydream in one call instead of two, and treats
 * the words as perturbation the daydream is free to ignore rather than material it must
 * incorporate. Measured against the two-call "must connect" shape across fresh random draws:
 * produced more varied daydreams (the "must connect" version settled onto the same handful of
 * daydreams across independent draws) and, on genuinely obscure random dictionary seeds, never
 * let an obscure seed word survive into the final suggestion -- the "must connect" version did,
 * twice in ten draws, apparently because forcing a connection to unusable material sometimes left
 * the model nothing to reach for but the material itself.
 *
 * buildAudienceThoughtPrompt and buildAudienceAssociationPrompt below are kept, unused by
 * generateAudiencePrompt, so the three-call shape stays available if it's ever needed again.
 */
export function buildAudienceGroundingPrompt(params: { seedWords: string[] }): string {
  return `You are simulating one ordinary audience member at a live improv or standup show,
caught in a brief daydream.

These words are floating through your mind right now, more like background static than a topic:
${JSON.stringify(params.seedWords)}. They are NOT a puzzle to solve and your daydream does not
need to end up connected to any of them, or reference them at all -- they're only here to jostle
your thinking away from whatever you'd have thought of anyway. Let your mind wander wherever it
actually goes from that jostle, even if it lands somewhere with no obvious link back to the words.

Use plain, everyday language. It can be odd, distracted, personal, or mundane, but it should read
as one connected thought, not an improv prompt already.

Return one concise association matching the required schema.`;
}

export function buildAudienceAssociationPrompt(params: { thought: string }): string {
  return `You are still simulating one ordinary audience member at a live improv show.

Translate this private internal thought into one everyday association that could plausibly pop
into their head next. Use plain, common language an average audience member would know.

Do not repeat obscure, archaic, technical, or dictionary-looking words from the thought unless
an average person would know them. Preserve the feeling or concrete image instead of explaining
the thought.

Return one concise association matching the required schema.

Private internal thought:
${params.thought}`;
}

export function buildAudienceSuggestionPrompt(params: {
  association: string;
  promptType: AudiencePromptTypeDefinition;
}): string {
  return `You are attending a live improv show.

The performers ask the audience for ${params.promptType.requestText}.
What do you shout out off the top of your head?

Return a JSON response matching the required schema. The suggestion should be very short and
brief enough to be heard clearly by actors on stage. Do not turn it into a full premise.

Shout the thing itself, not a description of it. Favor a blurted word or short noun phrase --
one to four words -- over a written sentence or clause, and keep any explanation of the
connection out of the suggestion; that belongs in the rationale instead. For example, if the
association makes you think of dust settling on cloth, shout "unexpected grit" -- not "a sudden
fine layer of grit dusting everything." The second one reads like a description written for a
page, not something a person yells across a room.

Derive the suggestion from the specific content of the last thought below, even when it is
abstract or odd -- find whatever is genuinely nearest to it instead of reaching for a generic,
stock, or unrelated answer just because the thought is hard to convert. A safe cliché that only
contrasts with the thought does not count as a real connection.

Keep the vocabulary itself ordinary: every word in the suggestion should be something any adult in
the audience would immediately recognize, even if the material above used a rarer or more
technical word. Translate the idea behind an unfamiliar word into everyday language rather than
repeating the word itself.

Use the required fields this way:
- type: exactly "${params.promptType.id}".
- suggestion: what the audience member shouts -- the pithy thing itself, in as few words as
  possible.
- rationale: one concise sentence explaining specifically how the suggestion was derived from the
  last thought (not merely how it contrasts with it) and confirming it satisfies the requested
  type. Keep this as a brief audit note, not private step-by-step reasoning.

Prompt-type requirement:
${params.promptType.instructions}

The last thing you think about before shouting your suggestion is:
${params.association}`;
}
