# Audience prompt strategy experiment

A side project, not part of the shipped CLI: it exists to answer one question with real model
output instead of a guess -- **can the 3-call audience-prompt pipeline (thought → association →
suggestion) be simplified, and does that help or hurt "rounding out" obscure seed words into
something pithy?**

See the chat discussion this came from for the full reasoning. Short version: `initial-plan.md`
§12A already warns that asking one model call to do the work of several "usually produces an
overly coherent miniature plot," and separately recommends cleaning the seed-word source itself
(reject obscure/archaic/proper-noun entries) rather than relying only on an AI call to launder
them after the fact. This experiment tests both levers side by side instead of assuming either
one is right.

## What it runs

A 6 (prompt type) × 3 (call depth) × 2 (seed source) grid, all against the real configured model
via the actual `openai` client and `runJsonQuery` retry/logging plumbing:

- **Call depth** -- `3step` is a faithful reconstruction of production's
  `generateAudiencePrompt` (same prompt builders and schemas, imported unchanged from
  `src/improv/`, just parameterized on already-resolved seed words so the same triple can be
  replayed at every depth). `2step` merges the thought + association stages into one new
  "grounded association" prompt (`experimentalPrompts.ts`), then reuses the real suggestion
  prompt/schema unchanged. `1step` collapses everything -- seed words straight to the typed
  suggestion -- in one new prompt.
- **Seed source** -- `raw` uses fixed seed-word triples (defined in `testCases.ts`) replayed
  unchanged across all three depths. Every prompt type gets **two** fixed cases: an ordinary draw
  and a genuinely obscure real dictionary word triple (confirmed present in
  `/usr/share/dict/words`) picked specifically to stress-test "rounding out" -- 12 cases total.
  An earlier version of this experiment split ordinary vs. obscure across _different_ prompt types
  (only `problem`/`challenge`/`complication` ever saw obscure words), which confounded "is
  obscurity handled well" with "is this prompt type handled well"; giving every type both flavors
  fixes that. `curated` draws fresh random words from a hand-picked pool of unmistakably common
  words plus pop-culture names/objects/settings (`curatedWordSource.ts` / `audienceWordBank.txt`,
  ~890 entries, including 100 films/franchises and 100 novels across genres) -- the "curated bank"
  `initial-plan.md` recommends as an alternative to treating the system dictionary as a clean
  vocabulary. Since each curated draw is one random roll of the dice, every prompt type gets
  **three** independent draws (`CURATED_DRAWS_PER_TYPE` in `run.ts`), not just one, so a single
  lucky or unlucky draw doesn't stand in for the whole strategy -- 18 draws total.

### A note on the pop-culture entries

`audienceWordBank.txt` includes recognizable characters, objects, and settings (`Sherlock
Holmes`, `a lightsaber`, `a boss battle`) alongside plain words. **Standing rule: no Harry Potter
references of any kind** -- not the franchise name, characters, places, objects, or spells. This
is enforced by hand, not by a filter, so re-check with a quick grep after any bulk edit to this
file (`hogwarts|horcrux|quidditch|sorting hat|diagon alley|ministry of magic|muggle|dumbledore|
voldemort|hermione|hagrid|snape|gryffindor|slytherin|hufflepuff|ravenclaw`, etc. -- note `muggle`
alone false-positives on words like "smuggler", so eyeball any hit before removing it).

Every entry is a bare name, noun, or
short noun phrase -- never a quoted line of dialogue, lyric, or other excerpted passage. That
line is the one that matters: names, titles, and short phrases aren't copyrightable subject
matter on their own (37 CFR §202.1 excludes "words and short phrases such as names, titles, and
slogans" from protection), and referring to a trademarked thing by its name to mean the actual
cultural touchstone -- not to brand this tool's own output, and not as part of a commercial
product -- is nominative use, not infringement. That's the same category of use as a trivia game
or crossword clue referencing "Frodo," not the same as reproducing a script, lyric, or artwork.
The practical rule when extending the list: names/titles/objects/settings are fine; an actual
quoted line, lyric, or plot synopsis is not (and isn't useful as a "seed word" anyway).

Only the 2-step and 1-step prompts are new/experimental. Everything else (the 3-step prompts, both
schemas, `runJsonQuery`, the system prompt) is imported directly from `src/improv/` and
`src/services/` -- nothing under test is reimplemented or paraphrased, so the comparison is fair.

Each grid cell is wrapped so a single schema/API failure records an error on that cell instead of
aborting the whole run.

## Running it

```bash
npm run experiment:audience-strategies
```

Needs the same `.env` (`AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`) as the rest of the app -- it
runs against whatever model is actually configured (Ollama-hosted `gemma4` at the time this was
written). 180 total AI calls (12 raw cases + 18 curated draws, x 6 calls each for the
3step/2step/1step depths combined). Calls run sequentially, not in parallel, so this takes a
while: the original 72-call version of this grid took ~28 minutes wall-clock against a local
`gemma4`, so budget on the order of an hour-plus for the full 180-call grid against a similar
local model. Run it in the background.

## Reading the output

Everything lands in `results/<runId>.*` (gitignored -- these are run artifacts, not source):

- `<runId>.md` -- the actual deliverable. An aggregate table (avg word count / latency / errors
  per strategy) followed by a per-prompt-type section showing every strategy's suggestion,
  rationale, and intermediate stage text side by side, for a human to read and judge pithiness
  directly. Word count is reported as a weak objective signal only -- an 8-word punchy exclamation
  and an 8-word flat description are both "8 words," so read the actual text, don't just compare
  the numbers.
- `<runId>.json` -- the same data, structured, if you want to slice it differently.
- `<runId>.raw.jsonl` -- every request/response pair, same shape as `logs/ai-full.jsonl`, tagged
  with an `operation` field like `experiment:raw-2step:grounded` if you want to inspect a specific
  call.

This isn't wired into `npm run prchecks` or `vitest` -- it's a one-off research tool, not
production code, even though it's typechecked (`experiments` is in `tsconfig.json`'s `include`)
and linted like the rest of the repo.

## A second script: variety/collapse, not depth

`run.ts` above answers "how many calls." `run-variety.ts` answers a different question that came
up while reading its results: does a strategy produce genuinely different suggestions across many
draws, or does it quietly settle onto a small attractor set? A "no seed at all" control measured
this directly -- 5 independent temperature-1.5 draws collapsed onto 2 ideas, 2 of them word-for-word
identical. That motivated `buildDecoupledAssociationPrompt` (`experimentalPrompts.ts`): the seed
words are treated as pure perturbation the daydream is free to ignore, not material it has to
connect to. With decoupling, the same kind of test produced genuinely different scenes with no
repeats.

Two things fell out of testing that are worth knowing before extending this further:

- **Connection-to-seed is deliberately not a scoring criterion in `run-variety.ts`.** The seed
  words' job is to jostle the model off whatever it would have defaulted to, not to be reflected
  in the output. A suggestion that has nothing to do with its seed words is a success here, not a
  drift failure -- that's a real reversal from how `run.ts`'s results were originally read.
- **Never instruct for "funny," "silly," or "random" directly.** Measured directly: "kazoo" turned
  up independently from two different models on the same seed once the framing leaned toward
  "noisy/silly object" -- asking for funny just swaps the boring-answer cliché (lighthouse) for the
  wacky-prop cliché (rubber chicken, kazoo, whoopee cushion), which is exactly as worn a rut.
  Whatever humor shows up needs to be a side effect of forced specificity, not a direct target.

`run-variety.ts` draws a _fresh_ seed triple every repeat -- including for the raw/dictionary arm
-- rather than reusing `testCases.ts`'s fixed hand-picked triples. Reusing a fixed triple across
repeats confounds "does this strategy collapse" with "is the input identical every time," which is
exactly what happened in an earlier ad-hoc check before this script existed. The only thing it
scores automatically is exact-duplicate detection (case/whitespace-normalized) on the grounded
thought and the final suggestion, per arm. Plain-vocabulary compliance, type fit, and -- the actual
goal -- whether a suggestion is funny are deliberately left for a human to judge from the report,
not scored automatically: an automated "funniness score" would just be another model call reaching
for its own cliché of funny, the same failure this whole direction exists to avoid.

```bash
npm run experiment:audience-variety
```

Same `.env` requirement as above. Runs 4 arms (current-2step / decoupled-2step, crossed with
raw / curated seed source) x 10 fresh draws each x 2 calls = 80 calls total. Report lands at
`results/<runId>-variety.md`.
