import { describe, expect, it, vi } from "vitest";
import { logger } from "../utils/logger.js";
import { runQueryCommand } from "./queryCommand.js";

describe("runQueryCommand", () => {
  it("logs an error and sets a non-zero exit code for an unknown schema name, without throwing", async () => {
    // arrange
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const originalExitCode = process.exitCode;

    // act
    await runQueryCommand("a prompt", { schema: "not-a-real-schema", maxAttempts: 2 });

    // assert
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("unknown schema"));
    expect(process.exitCode).toBe(1);

    // cleanup
    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
  });
});
