import { z } from "zod";

export const summarySchema = z.object({
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
});

export const sentimentSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  confidence: z.number().min(0).max(1),
});

export const exampleSchemas = {
  summary: summarySchema,
  sentiment: sentimentSchema,
} satisfies Record<string, z.ZodType>;

export type ExampleSchemaName = keyof typeof exampleSchemas;
