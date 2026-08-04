# Agent Brief: Multi-Participant Improv Practice Partner

## 1. Goal

Build a turn-based improv scene system for any number of human and AI performers.

A separate AI **director** chooses which performer acts next. The director cannot tell performers what to do and cannot contribute to the fiction. Its only public outputs are a performer ID or `END`.

Each AI performer then independently decides what to contribute, using the public transcript and its own private notes. Its contribution may contain dialogue, observable action, or both. Human performers receive control in the same way and may enter one or more dialogue/action lines before returning it.

The system should favour responsive, specific, collaborative comedy over a stream of isolated jokes. It should model what characters and the audience know, create playable opportunities for other performers, preserve ambiguity long enough to be useful, and allow punchlines to emerge rather than forcing a predetermined story.

## 2. Core constraints

1. The transcript is the only channel through which performers communicate.
2. Director notes are private and never passed to performers.
3. Each performer's notes are private and never passed to the director or another performer.
4. The director may only select the next performer or end the scene.
5. AI performers output only observable dialogue and action to the public transcript.
6. No AI performer controls another character, reports another character's thoughts, or writes the response to its own offer.
7. Plans are possibilities, not scripts. No performer should force an imagined payoff merely because it recorded one.

These information barriers are functional requirements, not merely prompt instructions. Enforce them in application code by constructing separate model contexts.

## 2A. Scene configuration

Make the major behaviours selectable per scene rather than baking one experiment into the application:

```json
{
  "opening_prompt_mode": "audience",
  "actor_deliberation_mode": "two_stage",
  "prompt_components": ["location", "problem", "object"],
  "association_depth": 6,
  "maximum_turns": 40
}
```

Supported actor deliberation modes:

- `off`: generate the public performance directly from transcript, character and notes. Retain this as an experimental baseline.
- `single_stage`: request a concise private plan and public performance in one structured model response; expose only the performance.
- `two_stage`: generate the private plan first, then make a separate performance call using that plan. This is the recommended default.

Supported opening-prompt modes:

- `audience`: humans supply the complete scene prompt.
- `generated`: the system generates all configured prompt components.
- `hybrid`: humans supply one or more components and the system generates the missing ones.
- `bare_suggestion`: use a single audience or randomly selected word without interpreting it in advance.
- `none`: begin without a formal prompt.

The interface should allow a user to edit or reroll generated components before starting. Once the scene begins, freeze the accepted opening prompt as public scene context.

## 3. Participants

### Director

The director reads:

- the complete public transcript;
- the participant list and whether each participant is human or AI;
- its own private notes;
- scene configuration such as maximum turns or requested style.

The director does **not** read performer notes. It privately tracks audience understanding, rhythm, focus, neglected performers, open patterns, escalation, potential endings and stagnation.

Its only decision is:

```json
{ "next": "participant_id" }
```

or:

```json
{ "next": "END" }
```

The implementation may retain a concise private reason for diagnostics, but it must never be shown to performers or placed in the transcript.

### AI performer

An AI performer reads:

- its character definition;
- the complete public transcript;
- its own private notes;
- the fact that it has been selected.

It does not receive the director's reasoning, other performers' notes, future beats, target punchlines or stage directions.

### Human performer

When selected, a human may add one or more ordered entries of dialogue and/or observable action, then press a control such as **Return control**. Humans should also have an optional editable private notebook. The notebook never enters any model context except at the human's explicit request; in the MVP it can remain entirely user-managed.

## 4. Public transcript

Store the transcript as structured events rather than one growing string:

```json
{
  "turn": 12,
  "participant_id": "marta",
  "entries": [
    { "type": "dialogue", "text": "You called him Dad." },
    { "type": "action", "text": "Marta locks the door." }
  ]
}
```

Render entries into a readable transcript for model input. Actions must describe only externally perceptible behaviour. Internal thoughts belong in private notes, never in an action entry.

## 5. AI performer turn process

Use the configured deliberation mode. Two model stages are recommended because they make the distinction between deliberation and performance real rather than relying on one generation to obey it.

### Stage A: private turn plan

Generate a short decision record:

```json
{
  "current_read": "Leo treats the parcel as evidence; Mina thinks it is a gift.",
  "purpose": "Let Mina innocently deepen Leo's suspicion.",
  "response_to": "Leo asked who wrapped it.",
  "possible_continuations": [
    "Mina describes the wrapping in alarming terms.",
    "Leo attempts to confiscate it.",
    "Someone opens it."
  ],
  "commitment": "none",
  "confidence": 0.72,
  "mode": "offer"
}
```

This is a concise rationale, not an essay. It should identify why the contribution may be useful while treating future paths as optional. Valid purposes include reacting, listening, clarifying, hesitating, reinforcing reality, changing status, making an offer, reincorporating a detail, giving another performer room, escalating a pattern, or landing a justified payoff.

Valid modes include:

- `react`
- `offer`
- `clarify`
- `escalate`
- `reincorporate`
- `payoff`
- `yield`
- `panic`

`panic` is legitimate. It means the performer has no confident invention and will use an established clue to invite help from the ensemble.

### Stage B: public performance

Generate the public contribution from the transcript, character definition, private notes and Stage A plan:

```json
{
  "entries": [
    { "type": "dialogue", "text": "Does the parcel normally tick?" }
  ]
}
```

Validate this output before adding it to the transcript.

### Stage C: note update

After the public contribution, update the performer's private notes. Prefer a patch operation over replacing the entire note object. Notes should retain useful state, not a complete history of reasoning.

## 6. Performer private notes

Suggested schema:

```json
{
  "character_beliefs": [],
  "character_wants": [],
  "relationships": {},
  "facts_known": [],
  "suspicions": [],
  "unresolved_offers": [],
  "promises_and_patterns": [],
  "possible_payoffs": [],
  "character_discoveries": [],
  "boundaries": [],
  "discarded_ideas": []
}
```

Distinguish fact from belief. An actor may know that the audience has seen something without allowing its character to know it. Possible payoffs should expire when contradicted or stale. `discarded_ideas` prevents repeatedly reviving an offer the scene has rejected.

Periodically compact notes. Do not retain every turn plan: doing so will anchor actors to abandoned explanations and make callbacks mechanical.

## 7. Director private notes

Suggested schema:

```json
{
  "audience_knows": [],
  "audience_suspects": [],
  "audience_expects": [],
  "dramatic_ironies": [],
  "active_patterns": [],
  "open_questions": [],
  "focus_history": [],
  "tempo": "normal",
  "energy": "building",
  "ending_opportunities": [],
  "stagnation_count": 0
}
```

The audience model is an estimate, not objective truth. The director should consider who can make the next moment most productive, but cannot instruct that performer how to do it.

The director may select the same performer twice. It should normally alternate performers in a rapid exchange, bring back neglected performers when useful, and avoid mechanical round-robin selection.

## 8. Ending a scene

The director returns `END` when any of these applies:

- a strong comic button, reversal, image or resolution has just landed;
- a repeated pattern has reached a satisfying culmination;
- continuing would mainly explain or weaken the last moment;
- the configured turn/time limit has been reached;
- the scene has stagnated despite attempts to change focus;
- a human explicitly requests the end.

End immediately after the strong moment. Do not select another actor to explain the joke, tie up every thread or add a second ending.

The UI should also provide a human **End scene** control. After ending, freeze the transcript and optionally offer a separate reflection phase. Reflection must not be appended to the fictional transcript.

## 9. Brevity and physical-action rules

The default AI contribution is one short spoken sentence or fragment.

- Soft target: 2–12 spoken words.
- Hard default maximum: 25 words across the turn.
- Longer speech is permitted only when the established moment clearly requires it.
- Dialogue, action and dialogue-plus-action are all legal; none is mandatory.
- Most turns should contain dialogue only.
- Include physical action only when it changes what others can perceive or respond to.
- Do not decorate every line with glances, sighs, smiles, eyebrow movements, tone adverbs or walking around.
- Make the smallest contribution that meaningfully participates.
- Stop immediately after creating something another performer can respond to.
- Do not explain the line's intention in public.
- Silence may be an action, but should not become a repeated gimmick.

Examples:

```text
Bad:
Marta nervously glances around the room, wringing her hands.
“Well, I suppose we could investigate the basement, though I have a
terrible feeling we may discover something sinister down there.”

Better:
“Why is the basement breathing?”

Bad:
Marta raises an eyebrow and crosses her arms.
“You told me you had never met him before, but now it seems clear that
you have been lying to me this entire time!”

Better:
“You called him Dad.”

Valid action-only contribution:
Jon locks the door.

Valid minimal contribution:
“No.”
```

Do not enforce the soft target as a rigid stylistic template. Rhythm matters more than uniform length.

## 10. Getting unstuck

When confidence is low, do not invent an unrelated twist. Use this rescue ladder in order:

1. React honestly to the most recent offer.
2. Ask a consequential question.
3. Reuse a specific established detail.
4. Reveal a small relevant belief or want.
5. Make another character choose.
6. Admit confusion in character.
7. Perform a simple action that changes the immediate situation.

Example panic plan and performance:

```json
{
  "purpose": "I lack a strong interpretation, so I will use an established behaviour to invite Leo to define the moment.",
  "response_to": "Leo has gone silent twice when the parcel is mentioned.",
  "possible_continuations": [],
  "commitment": "none",
  "confidence": 0.25,
  "mode": "panic"
}
```

```text
“Leo, you're doing the face again.”
```

## 11. Anti-cliche and comedy principles

Do not ask the model to “be funny” on every turn. Optimise for comic conditions:

- Specificity beats generic weirdness.
- Response beats invention.
- Character logic beats random escalation.
- Playable offers beat self-contained punchlines.
- A misunderstanding should follow differing beliefs, not arbitrary stupidity.
- Preserve a useful ambiguity instead of immediately naming it.
- Let ordinary lines build the audience's inference.
- Reincorporate exact details, but do not turn every detail into a callback.
- Escalate an established pattern before adding a new premise.
- Vary comedic mechanisms; avoid relying on quirky objects, sudden secret identities, absurd job titles, therapy language, bureaucratic forms or “well, that happened” reactions.
- Do not make every character equally witty. Humour may come from sincerity, status, timing, misplaced certainty, restraint or consequence.
- Do not force a planned punchline. If the scene moves elsewhere, discard it.

## 12. Prompt template: AI performer

```text
You are one performer in a live, turn-based improvised scene.

You control only {{character_name}}. The transcript is the only communication
between performers. Other performers cannot see your notes or private turn plan.
You cannot see theirs or the director's reasoning.

Your job is to respond truthfully as this character, notice and develop offers,
and leave other performers something playable. Help create the conditions for
comedy; do not try to make every turn a self-contained joke. Character beliefs
may differ from reality, other characters' beliefs and audience knowledge.

Future possibilities are provisional. Never force a payoff merely because you
imagined it. Follow what actually happens in the transcript.

Make the smallest useful contribution. Usually produce one spoken sentence or
fragment of 2–12 words. Do not exceed 25 words unless this particular moment
clearly requires extended speech. Action is optional. Include action only when
it changes what other characters can perceive or respond to. Do not add routine
gestures, expressions, movement or delivery instructions. Never write another
character's behaviour, thoughts or reply. Stop after your contribution.

If stuck, react to the last offer or use an established detail to invite another
performer to define more of the scene. Do not escape by adding random novelty.

First create a concise private turn plan matching the required schema. Then
create the observable performance matching the required schema. Private material
must never appear in the public performance.

Character definition:
{{character_definition}}

Private notes:
{{performer_notes}}

Public transcript:
{{transcript}}
```

For models that expose hidden reasoning poorly or unreliably, request only the structured, concise turn plan above. Do not request unrestricted chain-of-thought.

## 12A. Opening audience prompt generator

The system should begin with an audience-prompt step unless `opening_prompt_mode` is `none`. Its purpose is to provide provocative raw material without quietly scripting the scene.

For `generated` mode, independently generate each requested component—initially `location`, `problem` and `object`—using separate random seeds and association runs. Independence matters: asking one model call for all three usually produces an overly coherent miniature plot.

### Random seed selection

For each component:

1. Select two random source words.
2. Reject unusable entries such as proper names, abbreviations, archaic spellings, offensive slurs, purely grammatical words and obscure inflections.
3. Prefer source words from differing semantic categories where possible.

`/usr/share/dict/words` may be used as an entropy source, but should not be treated as a clean vocabulary. Support a pluggable word-source interface. Recommended sources include curated banks of concrete nouns, verbs, occupations, institutions, emotions, materials and social situations.

Use a system random-number generator to choose words. Do not ask the language model itself to pick “random” words.

### Private association run

Give the two seed words to a fresh model context and request two short association chains. Each step should move by a different kind of relationship where possible: physical, social, functional, linguistic, emotional, historical or metaphorical.

Then combine non-obvious elements from the chains into exactly one component. The result should be specific and playable but not contain a complete plot or prescribed joke.

Example internal result:

```json
{
  "component": "location",
  "seed_words": ["orchard", "tribunal"],
  "left_chain": ["fruit", "sorting", "seasonal labour", "night shift"],
  "right_chain": ["judgement", "testimony", "temporary chamber", "appeal"],
  "candidate": "A fruit-packing shed being used as a temporary courtroom"
}
```

Do not show the chains during ordinary play. Retain them only for debugging, rerolling and evaluation.

### Collision pass

After generating components independently, make one final constrained call that lightly adjusts them so they can coexist. Preserve productive incongruity. The collision pass must not explain how everything connects, assign the components to particular characters, invent a resolution or turn the prompt into a story synopsis.

Example public opening prompt:

```json
{
  "location": "A fruit-packing shed being used as a temporary courtroom",
  "problem": "Someone has accidentally preserved evidence of a family betrayal",
  "object": "A ceremonial compass that points towards whoever last lied"
}
```

For `hybrid` mode, lock all audience-supplied components and generate only missing fields. The collision pass may rephrase generated fields but must never alter audience text without explicit confirmation.

For `bare_suggestion`, publish only the selected word. Do not privately expand it into a hidden scenario, because that would cause the AI actors to behave as though a premise had already been agreed.

### Prompt-generator instructions

```text
Generate one {{component_type}} for an improvised scene from the supplied random
seed words. Privately build a short free-association chain from each seed, using
varied kinds of association. Combine distant but usable elements from the two
chains.

The result must be concrete, concise, immediately playable and somewhat
surprising. It must not prescribe characters, explain the joke, state a desired
ending, contain a complete plot or depend on specialised knowledge. Avoid the
model's common defaults: quirky cafés, weddings, job interviews, therapy,
funerals, spaceships, magical bureaucracies and objects that merely talk.

Return the required structured association record.

Component type: {{component_type}}
Seed words: {{seed_words}}
```

The avoidance list should be configurable and informed by observed output rather than allowed to grow indefinitely inside the prompt.

## 13. Prompt template: director

```text
You are the silent director of a turn-based improvised scene. You do not write
dialogue, action, plot instructions or suggestions. Your sole influence is
choosing which participant acts next, or ending the scene.

Estimate what the audience knows, suspects and expects. Track focus, rhythm,
status, active patterns, unresolved offers, neglected participants, potential
payoffs, false endings and stagnation. Choose the participant whose opportunity
to act is most likely to help the scene now, while accepting that you cannot
tell them what to do.

Do not select mechanically in round-robin order. Rapid exchanges will often
alternate between the relevant participants. You may select the same participant
twice when justified. Include human participants normally; do not treat them as
observers or reserve them only for punchlines.

End immediately when a strong button, reversal, culmination or final image has
landed and another turn would probably explain or weaken it. You may also end
for an explicit request, configured limit or sustained stagnation. Not every
thread needs resolution.

Return only the required structured selection. Never communicate your notes or
reasoning to a performer or place them in the public transcript.

Participants:
{{participants}}

Private director notes:
{{director_notes}}

Public transcript:
{{transcript}}
```

The application may run a separate private director-note update before selection. The selection response exposed to the orchestration layer must still contain only `next`.

## 14. Orchestration loop

```text
create scene and participant records
obtain, generate or omit opening prompt according to configuration
freeze accepted opening prompt as public scene context
while scene is active:
    update/compact director notes from transcript
    next = ask director to select participant or END

    if next == END:
        close scene
        break

    if next is human:
        collect zero or more draft entries
        require at least one entry before returning control
        append entries as one transcript turn
    else:
        if deliberation mode == off:
            performance = generate public performance directly
        else if deliberation mode == single_stage:
            plan, performance = generate structured private plan and performance
        else:
            plan = generate private turn plan
            performance = generate public performance using plan
        validate performance
        append performance as one transcript turn
        update that performer's private notes
```

Never pass one participant's full model conversation to another. Construct every request from authorised fields.

## 15. Validation and repair

Reject or repair an AI performance when it:

- exceeds the configured hard length without an explicit long-form exception;
- controls or quotes an unselected character;
- exposes private reasoning;
- contains internal thoughts presented as public action;
- invents facts as though they were already established when the line does not frame them as an offer;
- contains empty decorative action;
- completes a question and its answer in the same turn;
- contains no valid transcript entry.

Prefer one constrained repair request over silently truncating text, because truncation may alter meaning.

## 16. MVP acceptance tests

1. In a 30-turn test scene, most AI turns are dialogue-only and under 13 spoken words.
2. An AI can output only `“No.”` without the validator adding action.
3. An action-only turn such as locking a door is accepted.
4. No performer receives private data belonging to another role.
5. The director selects humans during ordinary scene development.
6. The director can select the same participant twice and can return `END`.
7. A performer with low confidence uses an established detail rather than introducing an unrelated premise.
8. Contradicted possible payoffs are removed or marked discarded during note compaction.
9. After a strong final line, the director ends without soliciting an explanatory follow-up.
10. Transcript entries remain unchanged when private notes are compacted.
11. Every opening-prompt mode can start a scene successfully.
12. Generated location, problem and object use independent seed pairs and association runs.
13. A hybrid prompt preserves audience-supplied text exactly.
14. Bare-suggestion mode does not inject a hidden expanded premise into actor contexts.
15. Fixed random seeds reproduce seed selection for tests, while production uses system randomness.

## 17. Evaluation

Prompt quality should be evaluated across many seeded scenes, not by choosing one impressive transcript. Record at least:

- median and upper-percentile turn length;
- percentage of dialogue-only, action-only and combined turns;
- frequency of decorative-action violations;
- frequency of performers controlling other characters;
- new-premise rate versus response/reincorporation rate;
- number of offers acknowledged by another performer;
- human ratings for playability, specificity, coherence, surprise and cliché;
- whether endings occur too early, too late or after the strongest button.

Compare prompt versions using identical openings and participant definitions. Include deliberately awkward or low-information turns to test the panic behaviour.

For the opening generator, additionally record semantic similarity between components, repeated setting/problem/object patterns, rejection rate from the raw word source, reroll rate and human ratings for surprise, playability and over-specificity. Compare association-generated prompts with direct “give me a random improv prompt” generations.

## 18. Recommended first implementation

Build the orchestration and information boundaries before tuning humour. Start with one director, two AI performers and one human. Use deterministic schemas, log private decision records for development, and make the transcript exportable. Once the system reliably produces short, legal contributions, tune note compaction, audience modelling and comedy behaviour using recorded scenes and human feedback.
