import type { AudiencePromptTypeDefinition } from "../../src/improv/audiencePromptTypes.js";

/**
 * Experimental replacement for the thought+association pair
 * (buildAudienceThoughtPrompt + buildAudienceAssociationPrompt in
 * src/improv/prompts.ts): connects the seed words into one daydream-like
 * association in a single call. Output shape matches audienceAssociationSchema
 * exactly, so it can feed straight into the real, unmodified
 * buildAudienceSuggestionPrompt.
 *
 * This version assumes the seed words are already ordinary/recognizable (as
 * CuratedWordSource guarantees) rather than potentially obscure dictionary
 * entries -- it deliberately does NOT force a "translate unfamiliar words
 * down to something plain" step. An earlier version did, and it measurably
 * hurt: with already-ordinary seeds, that instruction just taught the model
 * to discard good, specific material for a generic image instead of using it
 * (e.g. ["Twenty Thousand Leagues Under the Sea", "unravel", "doily"]
 * produced "those yellow tags on picnic baskets" -- unconnected to any of the
 * three). If this ever needs to run against raw, potentially-obscure
 * dictionary words again, that instruction would need to come back.
 */
export function buildGroundedAssociationPrompt(params: { seedWords: string[] }): string {
  return `You are simulating one ordinary audience member at a live improv or standup show,
caught in a brief daydream.

Three concepts are drifting through their mind. Connect them into one short, natural daydream --
a stray thought built from a real (if loose) connection between all three, not a description of
just one of them, and not a generic image that quietly drops the others. Let the specific flavor
of each concept show through the connection; don't sand them down into something unrelated just
because they're specific or unusual.

For example, from ["Twenty Thousand Leagues Under the Sea", "unravel", "doily"], connect them --
say, an old lace doily unraveling like a fishing net, snagged on something deep underwater -- not
"those yellow tags on picnic baskets," which drops all three concepts and drifts toward something
disconnected instead.

When one of the concepts is a specific, recognizable film, novel, character, or franchise, you
don't have to abstract its identity away -- it's fine for its specific name or flavor to carry
into the daydream sometimes, not just its generic shape. Don't force this: only keep it
recognizable when that's genuinely where the daydream is heading anyway.

Use plain, everyday language. It can be odd, distracted, personal, or mundane, but it should read
as one connected thought, not an improv prompt already.

Return one concise association matching the required schema.

Concepts:
${JSON.stringify(params.seedWords)}`;
}

/**
 * Alternative to buildGroundedAssociationPrompt: treats the seed words purely as perturbation,
 * not as material the daydream is required to use or reference. Motivated by a direct
 * measurement, not a guess: with NO seed words at all, 5 independent temperature-1.5 draws
 * collapsed onto two ideas, two of them word-for-word identical ("the venue's smoke detector is
 * actually broken..." / "the venue's coffee tastes as burnt..."). With decoupled random seeds
 * (fresh draw every time, no requirement to connect), the same test produced five genuinely
 * different scenes and zero repeats -- so the words are still doing real perturbation work, just
 * not the "must connect to all three" work buildGroundedAssociationPrompt asks for.
 *
 * Also measured directly: obscure seed vocabulary does not leak into the final suggestion under
 * this framing. The model lets words it can't use go by unused rather than straining to include
 * them -- same as it does with any other seed here.
 *
 * Deliberately does NOT ask for "funny," "silly," "random," or "surprising" anywhere. That was
 * tried in spirit and measured out badly in an adjacent way: "kazoo" turned up independently from
 * two different models on the same seed once the surrounding framing leaned toward "noisy/silly
 * object." Asking for funny doesn't escape cliché, it swaps the boring-answer cliché for the
 * wacky-prop cliché -- rubber chicken, kazoo, whoopee cushion are exactly as worn a rut as
 * "lighthouse" is for a location. Whatever humor shows up here needs to be a side effect of forced
 * specificity, not a direct target -- that's the only way found so far to get it without also
 * reaching for comedy's own clichés.
 */
export function buildDecoupledAssociationPrompt(params: { seedWords: string[] }): string {
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

/**
 * Experimental full collapse of the entire pipeline (thought, association,
 * and suggestion) into a single call: random seed words straight to a typed,
 * schema-shaped suggestion. Reuses buildAudienceSuggestionSchema(promptType.id)
 * unchanged for validation -- only the prompt text differs from production.
 */
export function buildCollapsedSuggestionPrompt(params: {
  seedWords: string[];
  promptType: AudiencePromptTypeDefinition;
}): string {
  return `You are attending a live improv show and simulating one ordinary audience member.

Three concepts are drifting through your mind: ${JSON.stringify(params.seedWords)}. Let them
suggest one specific, connected daydream -- a real (if loose) link between all three, not a
description of just one of them or a generic image that drops the others -- the way a stray
thought would occur to someone sitting in a crowd.

The performers ask the audience for ${params.promptType.requestText}.
What do you shout out off the top of your head?

Return a JSON response matching the required schema. Shout the thing itself, not a description of
it: a blurted word or short noun phrase -- one to four words -- and brief enough to be heard
clearly by actors on stage. Do not turn it into a full premise, and do not explain the connection
in the suggestion itself; that belongs only in the rationale.

Use the required fields this way:
- type: exactly "${params.promptType.id}".
- suggestion: what the audience member shouts -- the pithy thing itself, in as few words as
  possible.
- rationale: one concise sentence explaining specifically how the suggestion was derived from the
  random words (not merely how it contrasts with them) and confirming it satisfies the requested
  type. Keep this as a brief audit note, not private step-by-step reasoning.

Prompt-type requirement:
${params.promptType.instructions}`;
}

/**
 * Experimental variant of the real buildAudienceSuggestionPrompt (src/improv/prompts.ts), kept
 * here rather than edited in place because it changes production wording -- this repo's owner
 * has held off on touching src/improv/ until the curated-source + 2-step direction is actually
 * wired in.
 *
 * MEASURED RESULT: this soft-permission approach does not work. Tested across three escalating
 * wordings (bare permission; permission + a worked example; the current version's explicit
 * "naming it isn't a cliché" framing) against 24 live calls total -- 0/24 final suggestions
 * named a pop-culture reference, including cases where the grounded thought had already
 * explicitly named one (HAL 9000, The Godfather, Pip/Great Expectations) and the suggestion
 * stage dropped it anyway. The rest of this same prompt has spent this whole file's history
 * being tuned to treat "the obvious/stock answer" as the failure mode to avoid (see the "safe
 * cliché" guard above), and that appears to dominate a soft permission every time.
 *
 * Kept here as a documented negative result, not deleted, so nobody re-tries this exact
 * approach later without knowing it was already measured. buildPopCultureAssertedSuggestionPrompt
 * below is the version that actually works: it doesn't ask the model to decide whether "sometimes"
 * applies -- popCultureSteer.ts rolls that dice in code, and only calls the assertive prompt on
 * a hit, where it can afford to be a flat requirement instead of a suggestion.
 */
export function buildPopCultureLeaningSuggestionPrompt(params: {
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

When the thought already explicitly names a specific film, book, character, or franchise (not
just its flavor -- the actual name is right there in the text), that name is a strong, valid
answer, not a cliché to avoid. Naming it is the most literal, most-derived-from-the-material
answer available, the opposite of the generic/stock escape the paragraph above warns against --
so don't launder it into something blander just to seem more original. For example, if the
thought says "a bunch of weirdly wet lightsabers in Shrek's swamp," shout "Shrek's swamp" or
"glowing lightsabers" -- not a generic "Neon sludge patch" that discards the name you were just
handed. Only fall back to something more ordinary when the thought didn't actually name anything
that specific in the first place -- don't force a reference that isn't really there.

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

/**
 * Only called when popCultureSteer.ts's coin flip already hit -- so unlike
 * buildPopCultureLeaningSuggestionPrompt, this can afford to require the reference instead of
 * merely permitting it. targetReferences are the pop-culture seed words actually drawn (there
 * may be more than one); the model still gets an escape hatch for the case where the daydream
 * genuinely moved on from all of them, so a forced-but-nonsensical reference isn't the only
 * option -- but the default posture here is "use it," which is the opposite of every other
 * suggestion prompt in this file.
 *
 * MEASURED RESULT (first wording, "must be or directly name that reference"): 0/5 on the small
 * local model this file was originally tuned against, 6/7 (86%) on a larger hosted model
 * (qwen3-6-35b-non-reasoning) -- see popCultureSteer.ts's doc comment. So the wording worked in
 * the sense of getting the name into the suggestion; but on review most of those "hits" were the
 * bare reference restated with barely a word added (e.g. seed "Pandora's box" -> suggestion
 * "Pandora's box", literally unchanged), not an actual riff.
 *
 * REVISED (current wording, "riff on it, don't just restate it"): 4/5 on the same larger model
 * combined the reference with the daydream's own specific details into something new -- e.g. a
 * Sith lord + a vampire's coffin + hating karaoke became "Karaoke-hating Vampire Vader", not
 * "Darth Vader". The one miss dropped the reference entirely rather than cheesing a bare
 * restatement -- a healthier failure mode than before, not a regression.
 */
export function buildPopCultureAssertedSuggestionPrompt(params: {
  association: string;
  promptType: AudiencePromptTypeDefinition;
  targetReferences: string[];
}): string {
  return `You are attending a live improv show.

The performers ask the audience for ${params.promptType.requestText}.
What do you shout out off the top of your head?

Return a JSON response matching the required schema. The suggestion should be very short and
brief enough to be heard clearly by actors on stage. Do not turn it into a full premise.

Shout the thing itself, not a description of it. Favor a blurted word or short noun phrase --
one to four words -- over a written sentence or clause, and keep any explanation of the
connection out of the suggestion; that belongs in the rationale instead.

At least one of the original concepts behind this daydream was a specific, recognizable
pop-culture reference: ${JSON.stringify(params.targetReferences)}. If the daydream above still
meaningfully connects to it, riff on that reference -- connect it to ONE specific detail from the
daydream, not several stacked together. A bare restatement of the name by itself is barely
different from reading the seed word back and does not count as a real answer here: from a
daydream about Pandora's box left open at a clearance rack while a sweater unravels, "Pandora's
box" alone is too bare -- "unraveling Pandora's sweater" is a real riff. But piling multiple
concepts into one dense, constructed phrase is its own failure in the other direction: from a
daydream mixing a Sith lord, a vampire's coffin, and hating karaoke, "Karaoke-hating Vampire
Vader" crams all three into a single mouthful that reads like a title, not something a person
would actually blurt. Pick the single cleanest connection and stop there -- it should still read
as a quick, blurted phrase, the same one-to-four-word bar as every other suggestion, not a
compound coinage. Only fall back to an ordinary answer with no reference at all if the daydream
has genuinely moved on from it and forcing one back in would be nonsensical.

Use the required fields this way:
- type: exactly "${params.promptType.id}".
- suggestion: what the audience member shouts -- the pithy thing itself, in as few words as
  possible.
- rationale: one concise sentence explaining specifically how the suggestion was derived from the
  last thought and confirming it satisfies the requested type. Keep this as a brief audit note,
  not private step-by-step reasoning.

Prompt-type requirement:
${params.promptType.instructions}

The last thing you think about before shouting your suggestion is:
${params.association}`;
}
