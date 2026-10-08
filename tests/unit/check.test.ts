import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { checkStoryboard, formatReport } from "../../src/skill/check";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("checkStoryboard", () => {
  it("passes a valid storyboard and reports stats and a length warning when outside 55-60 s", () => {
    const report = checkStoryboard(storyboard, facts);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats?.scenes).toBe(5);
    expect(report.warnings.join("\n")).toMatch(/estimated length .* outside 55-60 s/);
  });

  it("collects every independent issue in one run instead of stopping at the first", () => {
    const sb = clone(storyboard) as typeof storyboard;
    (sb.scenes[2].props as { value: number }).value = 58; // drop: fact says 57
    (sb.scenes[4] as unknown as { cues: { atWord: string }[] }).cues[0]!.atWord = "nonexistentword"; // cue not in narration
    sb.scenes[0].props.headline = "x".repeat(60); // does not fit
    const report = checkStoryboard(sb, facts);
    const text = report.issues.map((i) => i.message).join("\n");
    expect(report.ok).toBe(false);
    expect(text).toMatch(/"drop".*57/);
    expect(text).toMatch(/headline does not fit/);
    expect(text).toMatch(/"cpi"/); // the unresolvable cue is reported against its scene
  });

  it("reports one issue per bad scene within the same stage", () => {
    const sb = clone(storyboard) as typeof storyboard;
    (sb.scenes[1]!.props as { points: { y: number }[] }).points[0]!.y += 1; // line-chart no longer equals its fact
    (sb.scenes[2].props as { value: number }).value = 58; // big-number differs from its fact
    sb.scenes[0].props.headline = "x".repeat(60);
    sb.scenes[3].props.title = "y".repeat(31) + "!"; // kept legal; bar-race scene unchanged otherwise
    const report = checkStoryboard(sb, facts);
    const tracing = report.issues.filter((i) => i.stage === "fact tracing").map((i) => i.message);
    expect(tracing.length).toBeGreaterThanOrEqual(2);
    expect(tracing.join("\n")).toMatch(/"sp500"/);
    expect(tracing.join("\n")).toMatch(/"drop"/);
  });

  it("stops at schema errors and says so", () => {
    const sb = clone(storyboard) as { scenes: unknown[] };
    sb.scenes = [{ id: "x", type: "no-such-type" }];
    const report = checkStoryboard(sb, facts);
    expect(report.ok).toBe(false);
    expect(report.issues[0].stage).toBe("storyboard schema");
    expect(report.stats).toBeNull();
  });

  it("reports a facts schema error separately", () => {
    const report = checkStoryboard(storyboard, { facts: [] });
    expect(report.issues.some((i) => i.stage === "facts schema")).toBe(true);
  });

  it("adds advice warnings with scene ids", () => {
    const sb = clone(storyboard) as typeof storyboard;
    sb.scenes[0].narration = "You should buy the index today.";
    const report = checkStoryboard(sb, facts);
    expect(report.warnings.join("\n")).toMatch(/"intro".*you should buy/i);
  });
});

describe("formatReport", () => {
  it("lists issues by stage, then warnings, then a verdict line", () => {
    const text = formatReport({
      ok: false,
      issues: [{ stage: "cues", message: 'Scene "a" cannot render "emphasize" cues' }],
      warnings: ["something to look at"],
      stats: { scenes: 3, words: 100, estimatedSeconds: 40.1 },
    });
    expect(text).toMatch(/\[cues\] Scene "a" cannot render/);
    expect(text).toMatch(/warning: something to look at/);
    expect(text).toMatch(/FAIL: 1 issue/);
    expect(text).toMatch(/3 scenes, 100 words, about 40\.1 s/);
  });
  it("prints OK when there are no issues", () => {
    expect(formatReport({ ok: true, issues: [], warnings: [], stats: { scenes: 1, words: 5, estimatedSeconds: 3 } })).toMatch(/OK/);
  });
});
