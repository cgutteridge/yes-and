export const audiencePromptTypeIds = [
  "location",
  "problem",
  "challenge",
  "character",
  "item",
  "complication",
] as const;

export type AudiencePromptTypeId = (typeof audiencePromptTypeIds)[number];

export interface AudiencePromptTypeDefinition {
  id: AudiencePromptTypeId;
  requestText: string;
  instructions: string;
}

export const audiencePromptTypes: Record<AudiencePromptTypeId, AudiencePromptTypeDefinition> = {
  location: {
    id: "location",
    requestText: "a location",
    instructions:
      "The answer must be a place, setting, venue, room, building, area, or environment where " +
      "a scene could happen. Do not answer with a person, body part, emotion, object, or problem.",
  },
  problem: {
    id: "problem",
    requestText: "a problem",
    instructions:
      "The answer must be a problem, complaint, predicament, obstacle, or immediate difficulty " +
      "someone could be dealing with. Prefer plain present-tense phrasing.",
  },
  challenge: {
    id: "challenge",
    requestText: "a challenge",
    instructions:
      "The answer must be a playable challenge, task, obstacle, pressure, contest, or difficulty " +
      "the characters could actively deal with during a scene. Do not answer with a place, object, " +
      "character, or full plot summary.",
  },
  character: {
    id: "character",
    requestText: "a character or role",
    instructions:
      "The answer must be a person, job, role, social position, archetype, or playable character " +
      "type. Do not answer with a place, object, abstract image, or full situation.",
  },
  item: {
    id: "item",
    requestText: "an item",
    instructions:
      "The answer must be a concrete object, prop, possession, tool, food, document, machine, or " +
      "other thing someone could point to, hold, use, lose, want, or argue about.",
  },
  complication: {
    id: "complication",
    requestText: "a complication",
    instructions:
      "The answer must be a new wrinkle, disruption, constraint, surprise, misunderstanding, " +
      "or change that would make an existing scene harder or more interesting.",
  },
};

export function isAudiencePromptTypeId(value: string): value is AudiencePromptTypeId {
  return audiencePromptTypeIds.includes(value as AudiencePromptTypeId);
}

export function formatAudiencePromptTypeIds(): string {
  return audiencePromptTypeIds.join(", ");
}
