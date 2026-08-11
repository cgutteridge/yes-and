import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { z } from "zod";
import { JsonQueryError, parseAgainstSchema, runJsonQuery } from "./jsonQueryService.js";

const testSchema = z.object({ answer: z.string() });

function fakeClient(...responses: string[]) {
  const create = vi.fn();
  for (const content of responses) {
    create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
  }
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  return { client, create };
}

describe("parseAgainstSchema", () => {
  it("returns validated data when the content matches the schema", () => {
    // arrange
    const content = JSON.stringify({ answer: "42" });

    // act
    const result = parseAgainstSchema(content, testSchema);

    // assert
    expect(result).toEqual({ success: true, data: { answer: "42" } });
  });

  it("reports an error when the content is not valid JSON", () => {
    // arrange
    const content = "not json";

    // act
    const result = parseAgainstSchema(content, testSchema);

    // assert
    expect(result.success).toBe(false);
  });

  it("reports an error when the content does not match the schema", () => {
    // arrange
    const content = JSON.stringify({ answer: 42 });

    // act
    const result = parseAgainstSchema(content, testSchema);

    // assert
    expect(result.success).toBe(false);
  });
});

describe("runJsonQuery", () => {
  it("returns validated data on the first successful attempt", async () => {
    // arrange
    const { client } = fakeClient(JSON.stringify({ answer: "42" }));

    // act
    const result = await runJsonQuery(client, testSchema, "what is the answer?", {
      model: "test-model",
    });

    // assert
    expect(result).toEqual({ answer: "42" });
  });

  it("retries after an invalid response and succeeds on the next attempt", async () => {
    // arrange
    const { client, create } = fakeClient("not json", JSON.stringify({ answer: "42" }));

    // act
    const result = await runJsonQuery(client, testSchema, "what is the answer?", {
      model: "test-model",
    });

    // assert
    expect(result).toEqual({ answer: "42" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("combines caller system instructions with the JSON schema contract", async () => {
    // arrange
    const { client, create } = fakeClient(JSON.stringify({ answer: "42" }));

    // act
    await runJsonQuery(client, testSchema, "what is the answer?", {
      model: "test-model",
      systemInstructions: "You are a specialist test role.",
    });

    // assert
    const systemMessage = create.mock.calls[0]?.[0].messages[0].content as string;
    expect(systemMessage).toContain("You are a specialist test role.");
    expect(systemMessage).toContain("Respond with a single JSON object only.");
    expect(systemMessage).toContain('"answer"');
  });

  it("passes an explicit temperature to the provider request", async () => {
    // arrange
    const { client, create } = fakeClient(JSON.stringify({ answer: "42" }));

    // act
    await runJsonQuery(client, testSchema, "what is the answer?", {
      model: "test-model",
      temperature: 1.5,
    });

    // assert
    expect(create.mock.calls[0]?.[0]).toMatchObject({ temperature: 1.5 });
  });

  it("throws JsonQueryError after exhausting all attempts", async () => {
    // arrange
    const { client } = fakeClient("not json", "still not json");

    // act
    const act = () =>
      runJsonQuery(client, testSchema, "what is the answer?", {
        model: "test-model",
        maxAttempts: 2,
      });

    // assert
    await expect(act).rejects.toThrow(JsonQueryError);
  });

  it("writes AI usage and schema error attempts to the configured JSONL log", async () => {
    // arrange
    const tempDir = await mkdtemp(join(tmpdir(), "yesand-ai-log-"));
    const logPath = join(tempDir, "ai-usage.jsonl");
    const { client } = fakeClient("not json", JSON.stringify({ answer: "42" }));

    try {
      // act
      await runJsonQuery(client, testSchema, "what is the answer?", {
        model: "test-model",
        maxAttempts: 2,
        operation: "test-operation",
        aiLogPath: logPath,
        systemInstructions: "You are a logged test role.",
        temperature: 1.5,
      });

      // assert
      const lines = (await readFile(logPath, "utf8")).trim().split("\n");
      const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        operation: "test-operation",
        model: "test-model",
        temperature: 1.5,
        attempt: 1,
        max_attempts: 2,
        status: "schema_error",
        response: "not json",
      });
      expect(entries[0]?.system_prompt).toContain("You are a logged test role.");
      expect(entries[0]?.system_prompt).toContain("Respond with a single JSON object only.");
      expect(entries[0]?.system_prompt).toContain('"answer"');
      expect(entries[1]).toMatchObject({
        operation: "test-operation",
        model: "test-model",
        temperature: 1.5,
        attempt: 2,
        max_attempts: 2,
        status: "validated",
        response: JSON.stringify({ answer: "42" }),
      });
      expect(entries[1]?.system_prompt).toBe(entries[0]?.system_prompt);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
