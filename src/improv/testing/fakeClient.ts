import type OpenAI from "openai";
import { vi } from "vitest";

/**
 * The same hand-rolled duck-typed OpenAI client stub used in
 * ../../services/jsonQueryService.test.ts, extracted here so the improv
 * module's several test files (director/performer/orchestrator) can share
 * one copy instead of each re-declaring it. Only shapes the one call path
 * actually used (client.chat.completions.create); queues successive
 * responses via mockResolvedValueOnce.
 */
export function fakeClient(...responses: string[]) {
  const create = vi.fn();
  for (const content of responses) {
    create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
  }
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  return { client, create };
}
