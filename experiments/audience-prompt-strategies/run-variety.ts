/**
 * Variety/collapse experiment: does each strategy produce genuinely different suggestions across
 * many independent fresh draws, or does it quietly settle onto a small attractor set (exact or
 * near-duplicate outputs)? Motivated by a direct measurement: a "no seed at all" control
 * collapsed onto 2 ideas across 5 draws, with 2 of those 5 word-for-word identical. See
 * buildDecoupledAssociationPrompt's doc comment in experimentalPrompts.ts for the fuller account.
 *
 * Unlike run.ts (which holds seed words fixed across depths for a controlled comparison), this
 * draws a FRESH triple every single repeat, including for "raw" -- reusing a fixed hand-picked
 * triple across repeats confounds "does this strategy collapse" with "is the input identical
 * every time," a mistake made and caught in an ad-hoc probe before this script existed.
 *
 * Scoring here deliberately excludes "does the suggestion connect to its seed words" -- that is
 * NOT a goal of this pipeline; the seed words are pure perturbation, not material the daydream is
 * required to use. What this script checks automatically is narrow on purpose:
 *  - repetition: exact-duplicate detection (case/whitespace-normalized) on both the grounded
 *    thought and the final suggestion, per arm.
 * Everything else -- plain vocabulary an adult audience would recognize, whether it actually fits
 * the requested type, and (the real target) whether it's funny/delightful -- is left to a human
 * reading the report, not scored automatically. Humor especially: an automated "funniness score"
 * would just be another model call reaching for its own idea of funny, which risks the exact
 * wacky-prop cliché this whole direction is trying to avoid causing.
 *
 * Usage: npm run experiment:audience-variety
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../../src/config/env.js";
import { createAiClient } from "../../src/services/aiClient.js";
import { DictionaryWordSource, selectRandomWords } from "../../src/improv/audiencePrompt.js";
import {
  audiencePromptTypeIds,
  audiencePromptTypes,
} from "../../src/improv/audiencePromptTypes.js";
import type { AudiencePromptTypeId } from "../../src/improv/audiencePromptTypes.js";
import { logger } from "../../src/utils/logger.js";
import { CuratedWordSource } from "./curatedWordSource.js";
import {
  runDecoupledTwoStep,
  runTwoStep,
  safeRun,
  type StrategyContext,
  type StrategyResult,
} from "./strategies.js";

loadDotenv({ quiet: true });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(HERE, "results");

/** Fresh draws per arm. High enough to make a repeat-count meaningful, cheap enough to run in a
 * few minutes against a fast hosted model. */
const REPEATS_PER_ARM = 10;

const ARMS: Array<{
  id: string;
  run: typeof runTwoStep;
  wordSourceKind: "raw" | "curated";
}> = [
  { id: "current-raw", run: runTwoStep, wordSourceKind: "raw" },
  { id: "current-curated", run: runTwoStep, wordSourceKind: "curated" },
  { id: "decoupled-raw", run: runDecoupledTwoStep, wordSourceKind: "raw" },
  { id: "decoupled-curated", run: runDecoupledTwoStep, wordSourceKind: "curated" },
];

interface Draw {
  index: number;
  promptTypeId: AudiencePromptTypeId;
  seedWords: string[];
  result: StrategyResult;
}

interface DuplicateSummary {
  distinct: number;
  total: number;
  repeats: Array<{ text: string; count: number }>;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function duplicateSummary(texts: string[]): DuplicateSummary {
  const counts = new Map<string, { display: string; count: number }>();
  for (const text of texts) {
    if (!text) continue;
    const key = normalize(text);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { display: text, count: 1 });
    }
  }
  const repeats = Array.from(counts.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => ({ text: entry.display, count: entry.count }))
    .sort((a, b) => b.count - a.count);
  return { distinct: counts.size, total: texts.length, repeats };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createAiClient(config);
  await mkdir(RESULTS_DIR, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const ctx: StrategyContext = {
    client,
    model: config.model,
    aiFullLogPath: path.join(RESULTS_DIR, `${runId}-variety.raw.jsonl`),
  };

  const rawWords = await new DictionaryWordSource().loadWords();
  const curatedWords = await new CuratedWordSource().loadWords();

  const armDraws = new Map<string, Draw[]>();

  for (const arm of ARMS) {
    logger.info(`Running arm "${arm.id}" (${REPEATS_PER_ARM} fresh draws)...`);
    const draws: Draw[] = [];
    const words = arm.wordSourceKind === "raw" ? rawWords : curatedWords;
    for (let i = 1; i <= REPEATS_PER_ARM; i++) {
      const promptTypeId = audiencePromptTypeIds[(i - 1) % audiencePromptTypeIds.length];
      if (!promptTypeId) {
        throw new Error("audiencePromptTypeIds is empty -- this should be unreachable");
      }
      const promptType = audiencePromptTypes[promptTypeId];
      const seedWords = selectRandomWords(words, 3, Math.random);
      logger.info(
        `  ${arm.id} #${i}/${REPEATS_PER_ARM} (${promptTypeId}): ${seedWords.join(", ")}`,
      );
      const result = await safeRun(() => arm.run(ctx, seedWords, promptType, arm.id), arm.id);
      draws.push({ index: i, promptTypeId, seedWords, result });
    }
    armDraws.set(arm.id, draws);
  }

  const jsonPath = path.join(RESULTS_DIR, `${runId}-variety.json`);
  await writeFile(
    jsonPath,
    JSON.stringify({ runId, model: config.model, arms: Object.fromEntries(armDraws) }, null, 2),
  );

  const reportLines: string[] = [
    "# Audience prompt variety/collapse comparison",
    "",
    `Run: ${runId}  `,
    `Model: ${config.model}  `,
    `Raw per-call API log: \`${path.relative(HERE, ctx.aiFullLogPath)}\`  `,
    `Structured data: \`${path.relative(HERE, jsonPath)}\``,
    "",
    "Connection-to-seed is NOT a scoring criterion here -- the seed words are pure perturbation,",
    "not material the daydream needs to use (see experimentalPrompts.ts). Judge each entry on:",
    "whether it's a real repeat of another entry in the same arm (see the duplicate counts below),",
    "whether the vocabulary is plain enough for any adult audience, whether it actually fits the",
    "requested type, and -- the real goal -- whether it's funny/delightful. That last one is",
    "intentionally left to you, not scored automatically; see run-variety.ts's header comment for why.",
    "",
  ];

  for (const arm of ARMS) {
    const draws = armDraws.get(arm.id) ?? [];
    const ok = draws.filter((d) => d.result.error === undefined);

    reportLines.push(`## ${arm.id}`, "");

    const groundedTexts = ok
      .map((d) => d.result.stages.grounded)
      .filter((t): t is string => t !== undefined);
    const suggestionTexts = ok.map((d) => d.result.suggestion);
    const groundedDup = duplicateSummary(groundedTexts);
    const suggestionDup = duplicateSummary(suggestionTexts);

    reportLines.push(
      `**Duplicate check**: ${groundedDup.distinct}/${groundedDup.total} distinct grounded thoughts, ` +
        `${suggestionDup.distinct}/${suggestionDup.total} distinct suggestions ` +
        `(${draws.length - ok.length} error(s)).`,
    );
    if (groundedDup.repeats.length > 0) {
      reportLines.push(
        `- Repeated grounded thoughts: ${groundedDup.repeats.map((r) => `"${r.text}" (x${r.count})`).join("; ")}`,
      );
    }
    if (suggestionDup.repeats.length > 0) {
      reportLines.push(
        `- Repeated suggestions: ${suggestionDup.repeats.map((r) => `"${r.text}" (x${r.count})`).join("; ")}`,
      );
    }
    reportLines.push("");

    for (const draw of draws) {
      const { result } = draw;
      if (result.error) {
        reportLines.push(
          `${draw.index}. [${draw.promptTypeId}] seed=${JSON.stringify(draw.seedWords)} -- ERROR: ${result.error}`,
          "",
        );
        continue;
      }
      const groundedPrefix = result.stages.grounded
        ? `grounded: "${result.stages.grounded}" -- `
        : "";
      reportLines.push(
        `${draw.index}. [${draw.promptTypeId}] seed=${JSON.stringify(draw.seedWords)}`,
        `   ${groundedPrefix}suggestion: **"${result.suggestion}"**`,
        "",
      );
    }
  }

  const reportPath = path.join(RESULTS_DIR, `${runId}-variety.md`);
  await writeFile(reportPath, reportLines.join("\n"));

  logger.info("");
  logger.info(`Done. Report: ${reportPath}`);
  console.log(reportPath);
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
