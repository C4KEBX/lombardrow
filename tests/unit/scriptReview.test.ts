import { describe, expect, it } from "vitest";
import storyboard from "../../fixtures/fast/mortgage.storyboard.json";
import { parseStoryboard } from "../../src/schema/storyboard";
import { SCRIPT_REVIEW, parseReport, scriptGateIssue, scriptHash, type ScriptReview } from "../../src/skill/scriptReview";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const atDoor = (doorNo: number) => {
  const sb = clone(storyboard) as unknown as { meta: { doorNo: number }; scenes: { narration: string }[] };
  sb.meta.doorNo = doorNo;
  return sb;
};
const reviewOf = (sb: ReturnType<typeof parseStoryboard>, score: number, extra: Partial<ScriptReview> = {}): ScriptReview => ({
  score, verdict: "v", scriptHash: scriptHash(sb), reviewedAt: "2026-10-12T00:00:00Z", ...extra,
});

describe("the script review gate", () => {
  it("leaves videos before No. 006 alone", () => {
    expect(scriptGateIssue(parseStoryboard(atDoor(5)), undefined)).toBeUndefined();
  });

  it("needs a review at or over the minimum for the script as it stands", () => {
    const sb = parseStoryboard(atDoor(6));
    expect(scriptGateIssue(sb, undefined)).toMatch(/No script review yet/);
    expect(scriptGateIssue(sb, reviewOf(sb, SCRIPT_REVIEW.minScore - 1))).toMatch(/under the minimum of 70/);
    expect(scriptGateIssue(sb, reviewOf(sb, SCRIPT_REVIEW.minScore))).toBeUndefined();
  });

  it("lets Justin's override through, but not for a script edited since its review", () => {
    const raw = atDoor(6);
    const sb = parseStoryboard(raw);
    const override = { by: "Justin", reason: "ship it", at: "2026-10-12T00:00:00Z" };
    const low = reviewOf(sb, 40, { override });
    expect(scriptGateIssue(sb, low)).toBeUndefined();
    raw.scenes[0].narration = `${raw.scenes[0].narration} Again.`;
    const edited = parseStoryboard(raw);
    expect(scriptHash(edited)).not.toBe(scriptHash(sb));
    expect(scriptGateIssue(edited, low)).toMatch(/changed after its review/);
  });

  it("reads the score line from the reviewer's report", () => {
    expect(parseReport("# Script review\n\n**Score: 64/100**: Strong open, flat middle.\n")).toEqual({ score: 64, verdict: "Strong open, flat middle." });
    expect(() => parseReport("Score 64")).toThrow(/Score: NN\/100/);
  });
});
