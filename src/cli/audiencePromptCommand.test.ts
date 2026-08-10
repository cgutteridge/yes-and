import { describe, expect, it, vi } from "vitest";
import { logger } from "../utils/logger.js";
import { runAudiencePromptCommand } from "./audiencePromptCommand.js";

describe("runAudiencePromptCommand", () => {
  it("logs an error and sets a non-zero exit code for an empty prompt type", async () => {
    // arrange
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const originalExitCode = process.exitCode;

    // act
    await runAudiencePromptCommand("   ");

    // assert
    expect(errorSpy).toHaveBeenCalledWith("audience prompt type must not be empty");
    expect(process.exitCode).toBe(1);

    // cleanup
    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
  });
});
