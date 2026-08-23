import type { AudiencePromptTypeId } from "../../src/improv/audiencePromptTypes.js";

export interface FixedDepthTestCase {
  promptType: AudiencePromptTypeId;
  seedWords: string[];
  /** Why this triple was picked, shown in the report. */
  label: string;
}

/**
 * Fixed seed-word triples per prompt type id, replayed unchanged across the raw-3step,
 * raw-2step, and raw-1step strategies so the only variable is call structure.
 *
 * Every prompt type gets BOTH an ordinary draw and an obscure/archaic/technical stress-test
 * draw (rather than splitting ordinary vs. obscure across different types, as the first version
 * of this file did) -- that original split confounded "is obscurity handled well" with "is this
 * prompt type handled well," since e.g. only `problem`/`challenge`/`complication` ever saw
 * obscure words. Obscure entries are genuinely obscure real dictionary words, confirmed present
 * in /usr/share/dict/words on this machine, chosen to stress-test "rounding out" specifically,
 * since a handful of independent Math.random() draws is not guaranteed to surface any.
 */
export const fixedDepthTestCases: FixedDepthTestCase[] = [
  {
    promptType: "location",
    seedWords: ["lantern", "harbor", "whisper"],
    label: "ordinary draw",
  },
  {
    promptType: "location",
    seedWords: ["lazaretto", "columbarium", "apodyterium"],
    label: "obscure/archaic/technical stress test",
  },
  {
    promptType: "character",
    seedWords: ["plumber", "rumor", "orchard"],
    label: "ordinary draw",
  },
  {
    promptType: "character",
    seedWords: ["costermonger", "haruspex", "pettifogger"],
    label: "obscure/archaic/technical stress test",
  },
  {
    promptType: "item",
    seedWords: ["kettle", "ledger", "static"],
    label: "ordinary draw",
  },
  {
    promptType: "item",
    seedWords: ["thurible", "reticule", "chatelaine"],
    label: "obscure/archaic/technical stress test",
  },
  {
    promptType: "problem",
    seedWords: ["backpack", "thunderstorm", "elevator"],
    label: "ordinary draw",
  },
  {
    promptType: "problem",
    seedWords: ["borborygmus", "unweeting", "cranioplasty"],
    label: "obscure/archaic/technical stress test",
  },
  {
    promptType: "challenge",
    seedWords: ["bicycle", "deadline", "neighbor"],
    label: "ordinary draw",
  },
  {
    promptType: "challenge",
    seedWords: ["muktatma", "arsenfast", "picramic"],
    label: "obscure/archaic/technical stress test",
  },
  {
    promptType: "complication",
    seedWords: ["suitcase", "allergy", "traffic"],
    label: "ordinary draw",
  },
  {
    promptType: "complication",
    seedWords: ["irreticent", "wifelessness", "infamiliar"],
    label: "obscure/archaic/technical stress test",
  },
];
