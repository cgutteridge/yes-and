# AGENTS.md

CLI tool that calls an OpenAI-compatible AI API and validates the JSON
response against a schema. See [README.md](README.md) for setup and usage.

## Standards

RAS TypeScript CLI conventions apply (Claude Code skills: `ras-repo-bootstrap`,
`ras-typescript-general`, `ras-typescript-cli`, `ras-vitest`,
`ras-engineering-defaults`). Not using `ras-code-review` — play project, not
a team product.

## Secrets

Never read or print `.env` — it holds a real API key. `.env.example` is safe.

## Docs

Keep this file slim. Write anything non-obvious to `docs/` and link it here
instead of inlining it. Suggest additions here based on experience, or to
resolve contradicting information.

- [docs/architecture.md](docs/architecture.md)

## When stuck

Stop and ask the user rather than pushing through alone — after 2-3 failed
attempts at a fix with no progress, or before committing to a step in a
bigger task where the wrong path would waste a lot of effort.
