# yesand

Command-line tool for querying an OpenAI-compatible AI API and validating the
JSON response against a schema.

## Setup

    npm install
    cp .env.example .env

Fill in `.env`:

- `AI_API_KEY` — required.
- `AI_MODEL` — required. Whatever model name your provider expects (e.g. `gpt-4o-mini` for OpenAI).
- `AI_BASE_URL` — optional. Defaults to `https://api.openai.com/v1`. Point this at any
  OpenAI-compatible endpoint instead (Azure OpenAI, OpenRouter, a local model server, etc).

## Usage

    npm run dev -- "Summarize the plot of Hamlet" --schema summary
    npm run dev -- "Is this review positive: 'best pizza I've ever had'" --schema sentiment

Or build and run the bundled output:

    npm run build
    npm start -- "..." --schema summary

Set `DEBUG=1` to see per-attempt retry logging on stderr.

## How it works

See [docs/architecture.md](docs/architecture.md).

## Scripts

| Command                           | Purpose                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev -- <args>`           | Run the CLI from source (tsx)                                                          |
| `npm run build`                   | Bundle to `dist/index.js` (esbuild)                                                    |
| `npm start -- <args>`             | Run the built bundle                                                                   |
| `npm run lint` / `lint:fix`       | ESLint                                                                                 |
| `npm run format` / `format:check` | Prettier                                                                               |
| `npm run typecheck`               | `tsc --noEmit`                                                                         |
| `npm test`                        | Unit tests (fast, no network)                                                          |
| `npm run test:integration`        | Integration test that calls the real API — needs a real `.env`, skips itself otherwise |
| `npm run prchecks`                | lint + format:check + typecheck + test, all together                                   |

## Scope notes

This is a personal play project, not a team product, so a few things RAS repos normally
carry were left out on purpose:

- No CI pipeline — `npm run prchecks` covers the same validation locally.
- No formal PR review process.

Everything else (structure, tooling, test conventions) follows the team's usual TypeScript
CLI standards.
