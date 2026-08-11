# Architecture

- [src/config/env.ts](../src/config/env.ts) — validates `AI_API_KEY` / `AI_BASE_URL` /
  `AI_MODEL` / `AI_LOG_PATH` from the environment, fails fast with a clear message on
  missing/invalid values.
- [src/services/aiClient.ts](../src/services/aiClient.ts) — thin factory wrapping the `openai`
  SDK client, pointed at `AI_BASE_URL`.
- [src/services/jsonQueryService.ts](../src/services/jsonQueryService.ts) — sends the prompt,
  asks for JSON-object output, and validates the result against a Zod schema. Callers may add
  role-specific system instructions; the service always appends the JSON-only/schema contract to
  the system message. On a validation failure it feeds the error back to the model and retries
  (`maxAttempts`, default 2) before throwing `JsonQueryError`. Reused as-is by every structured
  call the improv system below makes.
- [src/services/aiUsageLog.ts](../src/services/aiUsageLog.ts) — appends one JSONL entry per
  AI attempt when configured by the command layer. The default command path writes
  `logs/ai-usage.jsonl`, including operation labels, model, the exact combined system prompt, the
  user prompt, temperature when explicitly set, provider usage metadata, and the raw AI response
  when one exists.
- [src/schemas/exampleSchemas.ts](../src/schemas/exampleSchemas.ts) — the schema registry
  selectable via `--schema`. Add a new one by exporting a Zod schema and adding it to
  `exampleSchemas`.
- [src/index.ts](../src/index.ts) — thin Commander entry point: wires the `query` and `scene`
  subcommands to `src/cli/*` and does nothing else.
- [src/cli/runCommand.ts](../src/cli/runCommand.ts) — shared error-dispatch wrapper for every
  command action: known error types are logged with a non-zero exit code, anything else rethrows.
- [src/cli/queryCommand.ts](../src/cli/queryCommand.ts) — the original generic-CLI behavior
  (query an API, validate against an example schema), extracted out of `index.ts` unchanged.
- [src/cli/sceneCommand.ts](../src/cli/sceneCommand.ts) — loads a scene-config file, runs a
  scene end-to-end, prints the resulting transcript as JSON.
- [src/cli/audiencePromptCommand.ts](../src/cli/audiencePromptCommand.ts) — demo wrapper for the
  simulated audience generator. It prints the generator walkthrough to stderr via `logger` and
  reserves stdout for the final JSON result.

Validation is always done locally against the Zod schema — the API's own `json_object` mode
only guarantees syntactically valid JSON, not that it matches your shape.

## Improv practice-partner system (`src/improv/`)

First implementation slice of the design in [initial-plan.md](../initial-plan.md) — see that
file for the full spec; this is a summary of what actually exists in code, not a replacement
for it.

- [src/improv/types.ts](../src/improv/types.ts) — internal domain types (`Participant`,
  `Transcript`, etc.), Zod-free since they're constructed by application code, not parsed.
- [src/improv/schemas.ts](../src/improv/schemas.ts) — every model-I/O Zod schema (turn plan,
  performance, both notes types, the director's selection). Field names are snake_case,
  matching `initial-plan.md`'s literal JSON shapes.
- [src/improv/notes.ts](../src/improv/notes.ts) — patch-merge semantics for both notes types:
  `discarded_ideas` appends and dedupes, every other field replaces when present in a patch.
- [src/improv/transcript.ts](../src/improv/transcript.ts) — appends turns (owns turn-number
  assignment) and renders a transcript to the plain text every prompt is built from.
- [src/improv/prompts.ts](../src/improv/prompts.ts) — pure prompt-string builders, including
  distinct actor and audience system prompts plus one user prompt per role/stage, each taking only
  the fields that role may see.
- [src/improv/audiencePrompt.ts](../src/improv/audiencePrompt.ts) — independent audience
  prompt generator slice: loads words through a pluggable `WordSource`, selects three with an
  injectable RNG, asks the model to connect them into one audience member's private thought,
  then asks for a very short shouted suggestion of the requested type. Both audience-model calls
  run at temperature `1.5`.
- [src/improv/director.ts](../src/improv/director.ts) — the director's two calls: a private
  notes update, then participant selection.
- [src/improv/performer.ts](../src/improv/performer.ts) — an AI performer's `two_stage` turn:
  private plan, public performance, private notes update. Performer calls run at temperature `1.2`.
- [src/improv/sceneConfig.ts](../src/improv/sceneConfig.ts) — the on-disk scene-config schema
  and loader; also where an unsupported (deferred) config value is rejected with a clear error.
- [src/improv/orchestrator.ts](../src/improv/orchestrator.ts) — `runScene`, the main loop tying
  all of the above together.

Only `opening_prompt_mode: "audience"` and `actor_deliberation_mode: "two_stage"` are
implemented; a scene-config file requesting anything else fails fast with a named
`SceneConfigError` rather than silently falling back to something unintended.
