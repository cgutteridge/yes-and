# yesand

Command-line tool being repurposed into a turn-based AI improv
practice-partner system — see [initial-plan.md](initial-plan.md) for the
full design spec. The code in this repo is currently still the generic CLI
plumbing (query an OpenAI-compatible API, validate the JSON response
against a schema) that the new system will be built on top of.

## Setup

    npm install
    cp .env.example .env

Fill in `.env`:

- `AI_API_KEY` — required.
- `AI_MODEL` — required. Whatever model name your provider expects (e.g. `gpt-4o-mini` for OpenAI).
- `AI_BASE_URL` — optional. Defaults to `https://api.openai.com/v1`. Point this at any
  OpenAI-compatible endpoint instead (Azure OpenAI, OpenRouter, a local model server, etc).
- `AI_LOG_PATH` — optional. Defaults to `logs/ai-usage.jsonl`.

## Usage

Three subcommands: `query` (the original generic AI-query CLI), `scene`
(runs a turn-based improv scene from a scene-config file — see
[initial-plan.md](initial-plan.md)), and `audience-prompt` (demos the
simulated-audience prompt generator).

    npm run dev -- query "Summarize the plot of Hamlet" --schema summary
    npm run dev -- query "Is this review positive: 'best pizza I've ever had'" --schema sentiment
    npm run dev -- scene --config fixtures/scenes/demo-scene.json
    npm run audience-prompt -- "location"

Or build and run the bundled output:

    npm run build
    npm start -- query "..." --schema summary
    npm start -- scene --config fixtures/scenes/demo-scene.json

Set `DEBUG=1` to see per-attempt retry logging on stderr.

Every real AI attempt is also appended to `logs/ai-usage.jsonl` by default, including the
operation name, model, token usage when the provider returns it, and the raw AI response when
one exists. Override the location with `AI_LOG_PATH`.

## How it works

See [docs/architecture.md](docs/architecture.md).

## Scripts

| Command                             | Purpose                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev -- <args>`             | Run the CLI from source (tsx)                                                          |
| `npm run audience-prompt -- <type>` | Demo the simulated-audience prompt generator for a prompt type such as `location`      |
| `npm run build`                     | Bundle to `dist/index.js` (esbuild)                                                    |
| `npm start -- <args>`               | Run the built bundle                                                                   |
| `npm run lint` / `lint:fix`         | ESLint                                                                                 |
| `npm run format` / `format:check`   | Prettier                                                                               |
| `npm run typecheck`                 | `tsc --noEmit`                                                                         |
| `npm test`                          | Unit tests (fast, no network)                                                          |
| `npm run test:integration`          | Integration test that calls the real API — needs a real `.env`, skips itself otherwise |
| `npm run prchecks`                  | lint + format:check + typecheck + test, all together                                   |

## Scope notes

This is a personal play project, not a team product, so a few things RAS repos normally
carry were left out on purpose:

- No CI pipeline — `npm run prchecks` covers the same validation locally.
- No formal PR review process.

Everything else (structure, tooling, test conventions) follows the team's usual TypeScript
CLI standards.
