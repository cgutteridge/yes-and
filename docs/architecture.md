# Architecture

- [src/config/env.ts](../src/config/env.ts) — validates `AI_API_KEY` / `AI_BASE_URL` /
  `AI_MODEL` from the environment, fails fast with a clear message on missing/invalid values.
- [src/services/aiClient.ts](../src/services/aiClient.ts) — thin factory wrapping the `openai`
  SDK client, pointed at `AI_BASE_URL`.
- [src/services/jsonQueryService.ts](../src/services/jsonQueryService.ts) — sends the prompt,
  asks for JSON-object output, and validates the result against a Zod schema. On a validation
  failure it feeds the error back to the model and retries (`maxAttempts`, default 2) before
  throwing `JsonQueryError`.
- [src/schemas/exampleSchemas.ts](../src/schemas/exampleSchemas.ts) — the schema registry
  selectable via `--schema`. Add a new one by exporting a Zod schema and adding it to
  `exampleSchemas`.
- [src/index.ts](../src/index.ts) — thin Commander entry point; wires the above together.

Validation is always done locally against the Zod schema — the API's own `json_object` mode
only guarantees syntactically valid JSON, not that it matches your shape.
