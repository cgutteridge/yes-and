/**
 * Side experiment: does collapsing the 3-call audience-prompt pipeline
 * (thought -> association -> suggestion) down to fewer calls help or hurt
 * "rounding out" obscure seed words into something pithy and ordinary? And
 * does cleaning the seed-word source itself make the AI laundering
 * unnecessary in the first place?
 *
 * Runs a grid of prompt type x call depth (3step/2step/1step) x seed source against the real
 * configured model, using the actual production prompt builders and schemas wherever they still
 * apply (only the 2-step and 1-step prompts are new -- see experimentalPrompts.ts). Each prompt
 * type gets two fixed raw cases (an ordinary draw and an obscure/archaic/technical stress test --
 * see testCases.ts) plus a few fresh random curated-bank draws, so a single lucky/unlucky draw
 * doesn't stand in for a whole strategy. Writes a JSON dump and a Markdown report for human
 * eyeballing under results/, plus a raw per-call API log (same shape as logs/ai-full.jsonl) for
 * anyone who wants to dig deeper.
 *
 * Usage: npm run experiment:audience-strategies
 * See README.md in this folder for how to read the output.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../../src/config/env.js";
import { createAiClient } from "../../src/services/aiClient.js";
import { selectRandomWords } from "../../src/improv/audiencePrompt.js";
import {
  audiencePromptTypeIds,
  audiencePromptTypes,
} from "../../src/improv/audiencePromptTypes.js";
import type {
  AudiencePromptTypeDefinition,
  AudiencePromptTypeId,
} from "../../src/improv/audiencePromptTypes.js";
import { logger } from "../../src/utils/logger.js";
import { CuratedWordSource } from "./curatedWordSource.js";
import { fixedDepthTestCases } from "./testCases.js";
import {
  runOneStep,
  runThreeStep,
  runTwoStep,
  safeRun,
  type StrategyContext,
  type StrategyResult,
} from "./strategies.js";

loadDotenv({ quiet: true });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(HERE, "results");

/** Fresh random curated-bank draws per prompt type, each replayed across all three depths --
 * averages out the luck of a single draw the way the fixed raw cases can't (those are fixed
 * specifically to be reproducible, not resampled). */
const CURATED_DRAWS_PER_TYPE = 3;

const DEPTH_RUNNERS: Array<{
  id: "3step" | "2step" | "1step";
  run: typeof runThreeStep;
}> = [
  { id: "3step", run: runThreeStep },
  { id: "2step", run: runTwoStep },
  { id: "1step", run: runOneStep },
];

interface SeedCase {
  /** Shown in the report: the raw case's fixed label, or "draw N" for a curated draw. */
  label: string;
  seedWords: string[];
  results: Record<string, StrategyResult>;
}

interface GridRow {
  promptType: AudiencePromptTypeId;
  rawCases: SeedCase[];
  curatedDraws: SeedCase[];
}

function summarize(results: StrategyResult[]): {
  count: number;
  errors: number;
  avgWords: number;
  avgLatencyMs: number;
} {
  const ok = results.filter((result) => result.error === undefined);
  const avgWords = ok.length === 0 ? 0 : ok.reduce((sum, r) => sum + r.wordCount, 0) / ok.length;
  const avgLatencyMs =
    ok.length === 0 ? 0 : ok.reduce((sum, r) => sum + r.elapsedMs, 0) / ok.length;
  return { count: results.length, errors: results.length - ok.length, avgWords, avgLatencyMs };
}

/** Every result recorded anywhere in the grid under the given strategy id, across every raw case
 * and every curated draw of every prompt type -- the pool the aggregate table summarizes. */
function collectResults(rows: GridRow[], strategy: string): StrategyResult[] {
  const cases = strategy.startsWith("raw-")
    ? rows.flatMap((row) => row.rawCases)
    : rows.flatMap((row) => row.curatedDraws);
  return cases
    .map((seedCase) => seedCase.results[strategy])
    .filter((result): result is StrategyResult => result !== undefined);
}

function formatStrategySection(strategy: string, result: StrategyResult): string {
  const lines = [
    `**${strategy}** (${result.calls} call${result.calls === 1 ? "" : "s"}, ${result.elapsedMs}ms)`,
  ];
  if (result.error) {
    lines.push(`- ERROR: ${result.error}`);
    return lines.join("\n");
  }
  for (const [stageName, stageText] of Object.entries(result.stages)) {
    lines.push(`- ${stageName}: "${stageText}"`);
  }
  const wordUnit = result.wordCount === 1 ? "word" : "words";
  lines.push(
    `- suggestion: **"${result.suggestion}"** (${result.wordCount} ${wordUnit}, type=${result.type})`,
  );
  lines.push(`- rationale: "${result.rationale}"`);
  return lines.join("\n");
}

/** Runs every call-depth strategy against one seed-word case and tags each result with the given
 * strategy-id prefix ("raw" or "curated"). */
async function runAllDepths(
  ctx: StrategyContext,
  seedWords: string[],
  promptType: AudiencePromptTypeDefinition,
  prefix: "raw" | "curated",
  logLabel: string,
): Promise<Record<string, StrategyResult>> {
  const results: Record<string, StrategyResult> = {};
  for (const depth of DEPTH_RUNNERS) {
    const strategy = `${prefix}-${depth.id}`;
    logger.info(`  ${strategy} / ${logLabel} (${seedWords.join(", ")})`);
    results[strategy] = await safeRun(
      () => depth.run(ctx, seedWords, promptType, strategy),
      strategy,
    );
  }
  return results;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createAiClient(config);
  await mkdir(RESULTS_DIR, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const ctx: StrategyContext = {
    client,
    model: config.model,
    aiFullLogPath: path.join(RESULTS_DIR, `${runId}.raw.jsonl`),
  };

  const rows = new Map<AudiencePromptTypeId, GridRow>(
    audiencePromptTypeIds.map((id) => [id, { promptType: id, rawCases: [], curatedDraws: [] }]),
  );

  logger.info(
    `Running raw-seed grid (${fixedDepthTestCases.length} cases x ${DEPTH_RUNNERS.length} depths)...`,
  );
  for (const testCase of fixedDepthTestCases) {
    const promptType = audiencePromptTypes[testCase.promptType];
    const row = rows.get(testCase.promptType);
    if (!row) {
      throw new Error(
        `no row for prompt type "${testCase.promptType}" -- this should be unreachable`,
      );
    }
    const results = await runAllDepths(
      ctx,
      testCase.seedWords,
      promptType,
      "raw",
      `${testCase.promptType} (${testCase.label})`,
    );
    row.rawCases.push({ label: testCase.label, seedWords: testCase.seedWords, results });
  }

  logger.info(
    `Running curated-seed grid (${audiencePromptTypeIds.length} types x ${CURATED_DRAWS_PER_TYPE} draws x ${DEPTH_RUNNERS.length} depths)...`,
  );
  const curatedWords = await new CuratedWordSource().loadWords();
  for (const id of audiencePromptTypeIds) {
    const promptType = audiencePromptTypes[id];
    const row = rows.get(id);
    if (!row) {
      throw new Error(`no row for prompt type "${id}" -- this should be unreachable`);
    }
    for (let drawIndex = 1; drawIndex <= CURATED_DRAWS_PER_TYPE; drawIndex++) {
      const seedWords = selectRandomWords(curatedWords, 3, Math.random);
      const label = `draw ${drawIndex}`;
      const results = await runAllDepths(ctx, seedWords, promptType, "curated", `${id} (${label})`);
      row.curatedDraws.push({ label, seedWords, results });
    }
  }

  const orderedRows = audiencePromptTypeIds.map((id) => {
    const row = rows.get(id);
    if (!row) {
      throw new Error(`no row for prompt type "${id}"`);
    }
    return row;
  });

  const strategyIds = [
    "raw-3step",
    "raw-2step",
    "raw-1step",
    "curated-3step",
    "curated-2step",
    "curated-1step",
  ];
  const aggregate = new Map(
    strategyIds.map((strategy) => [strategy, summarize(collectResults(orderedRows, strategy))]),
  );

  const jsonPath = path.join(RESULTS_DIR, `${runId}.json`);
  await writeFile(
    jsonPath,
    JSON.stringify({ runId, model: config.model, rows: orderedRows }, null, 2),
  );

  const reportLines: string[] = [
    "# Audience prompt strategy comparison",
    "",
    `Run: ${runId}  `,
    `Model: ${config.model}  `,
    `Raw per-call API log: \`${path.relative(HERE, ctx.aiFullLogPath)}\`  `,
    `Structured data: \`${path.relative(HERE, jsonPath)}\``,
    "",
    "## Aggregate summary",
    "",
    "| strategy | calls | avg words | avg latency (ms) | errors |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const strategy of strategyIds) {
    const stats = aggregate.get(strategy);
    if (!stats) continue;
    const calls = strategy.endsWith("3step") ? 3 : strategy.endsWith("2step") ? 2 : 1;
    reportLines.push(
      `| ${strategy} | ${calls} | ${stats.avgWords.toFixed(1)} | ${stats.avgLatencyMs.toFixed(0)} | ${stats.errors}/${stats.count} |`,
    );
  }

  reportLines.push("", "## Per prompt type", "");
  for (const row of orderedRows) {
    reportLines.push(`### ${row.promptType}`, "");
    for (const rawCase of row.rawCases) {
      reportLines.push(
        `Raw seed words (${rawCase.label}): \`${JSON.stringify(rawCase.seedWords)}\``,
        "",
      );
      for (const depth of DEPTH_RUNNERS) {
        const strategy = `raw-${depth.id}`;
        const result = rawCase.results[strategy];
        if (result) reportLines.push(formatStrategySection(strategy, result), "");
      }
    }
    for (const draw of row.curatedDraws) {
      reportLines.push(
        `Curated seed words (${draw.label}): \`${JSON.stringify(draw.seedWords)}\``,
        "",
      );
      for (const depth of DEPTH_RUNNERS) {
        const strategy = `curated-${depth.id}`;
        const result = draw.results[strategy];
        if (result) reportLines.push(formatStrategySection(strategy, result), "");
      }
    }
  }

  const reportPath = path.join(RESULTS_DIR, `${runId}.md`);
  await writeFile(reportPath, reportLines.join("\n"));

  logger.info("");
  logger.info(`Done. Report: ${reportPath}`);
  console.log(reportPath);
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
