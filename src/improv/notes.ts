import type {
  DirectorNotes,
  DirectorNotesPatch,
  PerformerNotes,
  PerformerNotesPatch,
} from "./schemas.js";

export function initialPerformerNotes(): PerformerNotes {
  return {
    character_beliefs: [],
    character_wants: [],
    relationships: {},
    facts_known: [],
    suspicions: [],
    unresolved_offers: [],
    promises_and_patterns: [],
    possible_payoffs: [],
    character_discoveries: [],
    boundaries: [],
    discarded_ideas: [],
  };
}

export function initialDirectorNotes(): DirectorNotes {
  return {
    audience_knows: [],
    audience_suspects: [],
    audience_expects: [],
    dramatic_ironies: [],
    active_patterns: [],
    open_questions: [],
    focus_history: [],
    tempo: "normal",
    energy: "building",
    ending_opportunities: [],
    stagnation_count: 0,
  };
}

/**
 * Applies a performer notes patch on top of stored notes. Every field
 * present in the patch REPLACES the stored value; a field absent from the
 * patch is left untouched. `discarded_ideas` is the one exception: it
 * APPENDS and dedupes instead of replacing, because its entire purpose
 * (initial-plan.md §6) is to accumulate a do-not-revisit list across the
 * whole scene -- a uniform replace policy would let the model silently
 * drop an old discarded idea it forgot to re-list, defeating that. Every
 * other field (including possible_payoffs) must be able to shrink, since
 * possible_payoffs is explicitly meant to expire when contradicted or
 * stale.
 */
export function applyPerformerNotesPatch(
  base: PerformerNotes,
  patch: PerformerNotesPatch,
): PerformerNotes {
  return {
    character_beliefs: patch.character_beliefs ?? base.character_beliefs,
    character_wants: patch.character_wants ?? base.character_wants,
    relationships: patch.relationships ?? base.relationships,
    facts_known: patch.facts_known ?? base.facts_known,
    suspicions: patch.suspicions ?? base.suspicions,
    unresolved_offers: patch.unresolved_offers ?? base.unresolved_offers,
    promises_and_patterns: patch.promises_and_patterns ?? base.promises_and_patterns,
    possible_payoffs: patch.possible_payoffs ?? base.possible_payoffs,
    character_discoveries: patch.character_discoveries ?? base.character_discoveries,
    boundaries: patch.boundaries ?? base.boundaries,
    discarded_ideas: patch.discarded_ideas
      ? dedupe([...base.discarded_ideas, ...patch.discarded_ideas])
      : base.discarded_ideas,
  };
}

/** Director notes have no discarded_ideas-style accumulator field, so every field is a plain replace-if-present. */
export function applyDirectorNotesPatch(
  base: DirectorNotes,
  patch: DirectorNotesPatch,
): DirectorNotes {
  return {
    audience_knows: patch.audience_knows ?? base.audience_knows,
    audience_suspects: patch.audience_suspects ?? base.audience_suspects,
    audience_expects: patch.audience_expects ?? base.audience_expects,
    dramatic_ironies: patch.dramatic_ironies ?? base.dramatic_ironies,
    active_patterns: patch.active_patterns ?? base.active_patterns,
    open_questions: patch.open_questions ?? base.open_questions,
    focus_history: patch.focus_history ?? base.focus_history,
    tempo: patch.tempo ?? base.tempo,
    energy: patch.energy ?? base.energy,
    ending_opportunities: patch.ending_opportunities ?? base.ending_opportunities,
    stagnation_count: patch.stagnation_count ?? base.stagnation_count,
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
