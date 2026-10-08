import { z } from "zod";
import { StoryboardError } from "./storyboard";

/** Source tiers from the accuracy standard: primary and scholarly stand alone; secondary needs a second independent source. */
export const SOURCE_TIERS = ["primary", "scholarly", "secondary"] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

const httpUrl = z.url().refine((u) => /^https?:\/\//i.test(u), "source url must be http(s)");

const CorroborationSchema = z.strictObject({ name: z.string().min(1), url: httpUrl, tier: z.enum(SOURCE_TIERS) });

const FactSchema = z.strictObject({
  id: z.string().min(1),
  claim: z.string().min(1),
  value: z.number().optional(),
  dataset: z.json().optional(),
  source: z.strictObject({
    name: z.string().min(1),
    /** Short form for the on-screen source stamp ("Federal Reserve, 2025"); defaults to `name`. */
    stamp: z.string().min(1).max(52).optional(),
    url: httpUrl,
    tier: z.enum(SOURCE_TIERS).optional(),
  }),
  /** Further independent sources that state the same claim (required behind a secondary source). */
  corroboration: z.array(CorroborationSchema).optional(),
  /** The story is contested; every scene that uses the fact must say so out loud. */
  disputed: z.boolean().optional(),
});

export const FactsSchema = z
  .strictObject({ facts: z.array(FactSchema).min(1) })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.facts.forEach((fact, index) => {
      if (seen.has(fact.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["facts", index, "id"],
          message: `duplicate fact id "${fact.id}"`,
        });
      }
      seen.add(fact.id);
    });
  });

export type Facts = z.output<typeof FactsSchema>;

export function parseFacts(input: unknown): Facts {
  const result = FactsSchema.safeParse(input);
  if (!result.success) throw new StoryboardError(z.prettifyError(result.error));
  return result.data;
}
