import { z } from "zod";
import { StoryboardSchema } from "../schema/storyboard";

/** JSON Schema of the storyboard contract. Refinements (cue rules, fact tracing, fit checks) are not representable and live in rules.md. */
export function buildCatalog(): string {
  const schema = z.toJSONSchema(StoryboardSchema, { unrepresentable: "any" });
  return `${JSON.stringify(schema, null, 2)}\n`;
}
