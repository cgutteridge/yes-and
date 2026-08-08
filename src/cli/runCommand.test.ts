import { describe, expect, it, vi } from "vitest";
import { ConfigError } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { runCommand } from "./runCommand.js";

describe("runCommand", () => {
  it("logs the message and sets a non-zero exit code for a known error type, without rethrowing", async () => {
    // arrange
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const originalExitCode = process.exitCode;
    const action = async () => {
      throw new ConfigError("bad config");
    };

    // act
    await runCommand(action);

    // assert
    expect(errorSpy).toHaveBeenCalledWith("bad config");
    expect(process.exitCode).toBe(1);

    // cleanup
    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
  });

  it("rethrows an error type it does not recognize", async () => {
    // arrange
    const action = async () => {
      throw new Error("totally unexpected");
    };

    // act & assert
    await expect(runCommand(action)).rejects.toThrow("totally unexpected");
  });

  it("resolves normally when the action succeeds", async () => {
    // arrange
    const action = async () => {
      /* no-op */
    };

    // act & assert
    await expect(runCommand(action)).resolves.toBeUndefined();
  });
});
