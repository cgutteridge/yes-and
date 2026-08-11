import { describe, expect, it } from "vitest";
import { takePerformerTurn } from "./performer.js";
import { initialPerformerNotes } from "./notes.js";
import { fakeClient } from "./testing/fakeClient.js";
import { JsonQueryError } from "../services/jsonQueryService.js";

const validPlanJson = JSON.stringify({
  current_read: "Leo is deflecting.",
  purpose: "Press gently on the deflection.",
  response_to: "Nothing to see here.",
  possible_continuations: [],
  commitment: "none",
  confidence: 0.6,
  mode: "clarify",
});
const validPerformanceJson = JSON.stringify({
  entries: [{ type: "dialogue", text: "Does it tick?" }],
});
const validNotesPatchJson = JSON.stringify({ suspicions: ["Leo is definitely hiding something."] });

describe("takePerformerTurn", () => {
  it("makes exactly 3 ordered calls: plan, then performance, then notes patch", async () => {
    // arrange
    const { client, create } = fakeClient(validPlanJson, validPerformanceJson, validNotesPatchJson);

    // act
    await takePerformerTurn(client, "test-model", {
      character: "A suspicious sister.",
      notes: initialPerformerNotes(),
      transcript: "",
    });

    // assert
    expect(create).toHaveBeenCalledTimes(3);
    for (const index of [0, 1, 2]) {
      const systemPrompt = create.mock.calls[index]?.[0].messages[0].content as string;
      expect(systemPrompt).toContain("AI actor in a turn-based improv practice scene");
      expect(systemPrompt).toContain("Respond with a single JSON object only.");
      expect(create.mock.calls[index]?.[0]).toMatchObject({ temperature: 1.2 });
    }
    const secondCallPrompt = create.mock.calls[1]?.[0].messages[1].content as string;
    const thirdCallPrompt = create.mock.calls[2]?.[0].messages[1].content as string;
    expect(secondCallPrompt).toContain("Leo is deflecting.");
    expect(thirdCallPrompt).toContain("Does it tick?");
  });

  it("returns the plan, performance, and patched notes", async () => {
    // arrange
    const { client } = fakeClient(validPlanJson, validPerformanceJson, validNotesPatchJson);

    // act
    const result = await takePerformerTurn(client, "test-model", {
      character: "A suspicious sister.",
      notes: initialPerformerNotes(),
      transcript: "",
    });

    // assert
    expect(result.plan.mode).toBe("clarify");
    expect(result.performance.entries).toEqual([{ type: "dialogue", text: "Does it tick?" }]);
    expect(result.notes.suspicions).toEqual(["Leo is definitely hiding something."]);
  });

  it("propagates JsonQueryError when the performance stage never validates", async () => {
    // arrange -- one valid plan response, then invalid performance responses
    // for all 3 attempts (takePerformerTurn's maxAttempts for this stage)
    const invalidPerformanceJson = JSON.stringify({ entries: [] });
    const { client } = fakeClient(
      validPlanJson,
      invalidPerformanceJson,
      invalidPerformanceJson,
      invalidPerformanceJson,
    );

    // act & assert
    await expect(
      takePerformerTurn(client, "test-model", {
        character: "A suspicious sister.",
        notes: initialPerformerNotes(),
        transcript: "",
      }),
    ).rejects.toThrow(JsonQueryError);
  });
});
