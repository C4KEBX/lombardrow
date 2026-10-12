import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Storyboard } from "../schema/storyboard";

/**
 * The script review gate (Justin, 2026-10-12): a reviewer scores the script before anything is
 * rendered, and `produce` refuses a script below the minimum unless Justin overrides it.
 */
export const SCRIPT_REVIEW = { minScore: 70, fromDoor: 6, file: "script-review.json", report: "script-review.md" } as const;

export const ScriptReviewSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
  verdict: z.string(),
  /** Hash of the words the review judged; any later edit to them needs a new review. */
  scriptHash: z.string(),
  reviewedAt: z.string(),
  override: z.strictObject({ by: z.string().min(1), reason: z.string().min(1), at: z.string() }).optional(),
});
export type ScriptReview = z.infer<typeof ScriptReviewSchema>;

/** What the reviewer judges: the hook line, the ending and every scene's narration and on-screen words. */
export function scriptHash(sb: Storyboard): string {
  const words = {
    hookLine: sb.meta.hookLine ?? null,
    ending: sb.meta.ending ?? null,
    scenes: sb.scenes.map((s) => [s.id, s.narration, "props" in s ? s.props : null]),
  };
  return crypto.createHash("sha256").update(JSON.stringify(words)).digest("hex").slice(0, 16);
}

export const reviewPathFor = (storyboardPath: string, name: string = SCRIPT_REVIEW.file): string =>
  path.join(path.dirname(storyboardPath), name);

/** Reads `**Score: NN/100**: verdict` from the reviewer's report. */
export function parseReport(markdown: string): { score: number; verdict: string } {
  const match = /\*\*Score:\s*(\d{1,3})\s*\/\s*100\*\*\s*[:\-–—]?\s*(.*)/.exec(markdown);
  if (!match) throw new Error('The script review has no "**Score: NN/100**" line');
  const score = Number(match[1]);
  if (score > 100) throw new Error(`Script review score ${score} is over 100`);
  return { score, verdict: match[2].trim() };
}

/** Why `produce` must not run yet, or undefined when the script may be built. */
export function scriptGateIssue(sb: Storyboard, review: ScriptReview | undefined): string | undefined {
  if (sb.meta.doorNo < SCRIPT_REVIEW.fromDoor) return undefined;
  const fix = `Run the script-reviewer agent, then "npm run script-review -- record --storyboard <path>"`;
  if (!review) return `No script review yet. ${fix}.`;
  if (review.scriptHash !== scriptHash(sb)) return `The script changed after its review (scored ${review.score}). ${fix}.`;
  if (review.override) return undefined;
  if (review.score < SCRIPT_REVIEW.minScore)
    return `The script scored ${review.score}, under the minimum of ${SCRIPT_REVIEW.minScore}. Rewrite it and review again, or only Justin can override it ("npm run script-review -- override").`;
  return undefined;
}

export function readReview(storyboardPath: string): ScriptReview | undefined {
  const file = reviewPathFor(storyboardPath);
  if (!fs.existsSync(file)) return undefined;
  return ScriptReviewSchema.parse(JSON.parse(fs.readFileSync(file, "utf-8")));
}

export function assertScriptReviewed(storyboardPath: string, sb: Storyboard): void {
  const issue = scriptGateIssue(sb, readReview(storyboardPath));
  if (issue) throw new Error(`Script review gate: ${issue}`);
}
