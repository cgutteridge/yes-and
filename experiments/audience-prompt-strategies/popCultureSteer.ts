/**
 * The code-driven mechanism for "more likely but not certain" pop-culture references in the
 * final shout. Three escalating attempts at a pure prompt-level nudge
 * (buildPopCultureLeaningSuggestionPrompt in experimentalPrompts.ts) measured 0/24 live calls --
 * see that function's doc comment for the full account. This replaces "ask the model to sometimes
 * decide to do it" with "decide in code, then tell it to when we've decided yes": a real, known
 * probability instead of an emergent one, and a flat requirement instead of a permission on the
 * turns where we've already decided the answer should be yes.
 *
 * MEASURED RESULT: model-dependent. Against the small local model this whole file was built
 * against, even the flat requirement failed (0/5 triggered calls actually named the reference,
 * including a case where both target names were sitting verbatim in the model's own immediate
 * input). Against a larger hosted model (qwen3-6-35b-non-reasoning), the identical mechanism and
 * identical assertive prompt scored 6/7 (86%) on trigger, giving ~30% of all suggestions a real
 * pop-culture reference overall -- and that model even volunteered one once on an untriggered
 * draw, something the small model never did across 24 tries. So the earlier failure was a
 * capability ceiling on that specific small model, not a flaw in this mechanism or its prompt.
 */
export interface PopCultureRollResult {
  /** At least one drawn seed word is a known pop-culture entry -- there's something to assert. */
  eligible: boolean;
  /** eligible AND the roll came up in favor of pushing for it. */
  triggered: boolean;
  /** The pop-culture seed word(s) found, if any -- passed to buildPopCultureAssertedSuggestionPrompt as the target(s) on a trigger. */
  targets: string[];
}

/** Case-insensitive lookup of which drawn seed words are pop-culture entries. */
export function findPopCultureSeeds(seedWords: string[], popCultureEntries: Set<string>): string[] {
  return seedWords.filter((word) => popCultureEntries.has(word.toLowerCase()));
}

/**
 * Rolls whether this run should push for a pop-culture reference in the final suggestion.
 * Only ever eligible when at least one seed word is a known pop-culture entry -- there's nothing
 * to assert otherwise, so "not certain" is guaranteed both by ineligibility and by the roll
 * itself. `random` is injectable (tests, reproducible demos); defaults to Math.random.
 */
export function rollPopCultureSteer(
  seedWords: string[],
  popCultureEntries: Set<string>,
  probability: number,
  random: () => number = Math.random,
): PopCultureRollResult {
  const targets = findPopCultureSeeds(seedWords, popCultureEntries);
  const eligible = targets.length > 0;
  const triggered = eligible && random() < probability;
  return { eligible, triggered, targets };
}
