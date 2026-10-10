import { describe, expect, it } from "vitest";
import planJson from "../../fixtures/no-004/plan.json";
import sbJson from "../../fixtures/no-004/rule-of-72.storyboard.json";
import specJson from "../../variation/variation_spec.json";
import { parseStoryboard } from "../../src/schema/storyboard";
import {
  VISUAL_SCENES, checkPlan, crossCheck, parseHistory, parsePlan, parseSpec, scriptOf, suggest, type HistoryEntry, type Plan,
} from "../../src/variation/index";

const spec = parseSpec(specJson);
const plan = parsePlan(planJson);
const sb = parseStoryboard(sbJson);

let door = 100;
/** A past video that shares nothing with the No. 004 plan unless overridden. */
const past = (over: Partial<Plan> = {}): HistoryEntry => ({
  doorNo: (door += 1),
  pillar: "origins",
  storyShape: "problem_it_solved",
  hookType: "date",
  era: "modern",
  region: "united_states",
  primaryVisual: "timeline",
  visualMetaphor: `a lighthouse number ${door}`,
  paletteLead: "parchment",
  musicBed: null,
  title: `Unrelated title number ${door}`,
  angle: "a",
  sources: ["https://a.example/1"],
  ...over,
});
const reasonsWith = (history: HistoryEntry[], over: Partial<Plan> = {}, script?: string) =>
  checkPlan({ ...plan, ...over }, history, spec, script).reasons.join("\n");

describe("checkPlan", () => {
  it("passes No. 004 on an empty history (cold start); its old-pacing script is now under the word floor", () => {
    expect(checkPlan(plan, [], spec)).toEqual({ ok: true, reasons: [] });
    expect(checkPlan(plan, [], spec, scriptOf(sb)).reasons).toEqual(["script is 158 words (175-215)"]);
  });
  it("rejects an option the spec does not list", () => {
    expect(reasonsWith([], { era: "jurassic" })).toMatch(/era "jurassic" is not one of/);
  });
  it("never repeats the previous story shape, hook or primary visual", () => {
    const text = reasonsWith([past({ storyShape: "then_to_now", hookType: "question", primaryVisual: "line_chart" })]);
    expect(text).toMatch(/storyShape "then_to_now" is the same as the previous video/);
    expect(text).toMatch(/hookType "question" is the same as the previous video/);
    expect(text).toMatch(/primaryVisual "line_chart" is the same as the previous video/);
  });
  it("allows a shape twice in five but not three times", () => {
    const two = [past({ storyShape: "then_to_now" }), past(), past()];
    expect(reasonsWith(two)).not.toMatch(/storyShape/);
    const three = [past({ storyShape: "then_to_now" }), past(), past({ storyShape: "then_to_now" }), past()];
    expect(reasonsWith(three)).toMatch(/storyShape "then_to_now" would appear 3 times in the last 5 \(max 2\)/);
  });
  it("caps runs: pillar, era, region and palette lead at 2 in a row", () => {
    const run = [past({ pillar: "mechanics", era: "early_modern", region: "mediterranean", paletteLead: "ink" }), past({ pillar: "mechanics", era: "early_modern", region: "mediterranean", paletteLead: "ink" })];
    const text = reasonsWith(run);
    for (const d of ["pillar", "era", "region", "paletteLead"]) expect(text).toMatch(new RegExp(`${d} ".*" would make 3 in a row`));
  });
  it("enforces pillar shares only from video 11", () => {
    const nine = Array.from({ length: 9 }, (_, i) => past({ pillar: i % 2 ? "words" : "mechanics" }));
    expect(reasonsWith(nine)).not.toMatch(/pillar/);
    const ten = Array.from({ length: 10 }, (_, i) => past({ pillar: i % 2 ? "words" : "mechanics" }));
    expect(reasonsWith(ten)).toMatch(/pillar "mechanics" would be 55% of the last 11 videos \(target 30%, max 40%\)/);
  });
  it("rejects a metaphor sharing half its words with a recent one", () => {
    expect(reasonsWith([past({ visualMetaphor: "a ledger column that doubles every nine lines in a merchant's book" })])).toMatch(/visual metaphor shares/);
  });
  it("rejects a music bed from the last three videos, but not older ones or none", () => {
    expect(reasonsWith([past({ musicBed: "bed-02" }), past(), past()], { musicBed: "bed-02" })).toMatch(/music bed "bed-02"/);
    expect(reasonsWith([past({ musicBed: "bed-02" }), past(), past(), past()], { musicBed: "bed-02" })).not.toMatch(/music bed/);
  });
  it("rejects a title whose first three words match one of the last ten", () => {
    expect(reasonsWith([past({ title: "The 500-year-old shortcut to wealth" })])).toMatch(/title starts "the 500 year"/);
  });
  it("needs at least three source sites", () => {
    expect(reasonsWith([], { sources: ["https://www.investor.gov/a", "https://investor.gov/b"] })).toMatch(/1 source site/);
  });
  it("checks script length and three-word phrase overlap with recent scripts", () => {
    const script = scriptOf(sb);
    expect(reasonsWith([], {}, "Too short.")).toMatch(/script is 2 words/);
    expect(reasonsWith([past({ script })], {}, script)).toMatch(/script shares 100% of its 3-word phrases/);
    expect(reasonsWith([past({ script: "Completely different words about bonds and Dutch ships in sixteen oh two." })], {}, script)).not.toMatch(/script shares/);
  });
});

describe("suggest", () => {
  it("lists everything on a cold start, in spec order", () => {
    expect(suggest([], spec).storyShape).toEqual(spec.dimensions.storyShape.options);
  });
  it("drops options the rules forbid and puts the least recently used first", () => {
    const history = [past({ hookType: "question" }), past({ hookType: "date" })];
    const hooks = suggest(history, spec).hookType;
    expect(hooks).not.toContain("date");
    expect(hooks.indexOf("surprising_number")).toBeLessThan(hooks.indexOf("question"));
    expect(hooks.at(-1)).toBe("question");
  });
});

describe("crossCheck", () => {
  it("passes No. 004 against its storyboard", () => {
    expect(crossCheck(plan, sb, spec)).toEqual([]);
  });
  it("catches a plan that does not describe the storyboard", () => {
    const text = crossCheck({ ...plan, doorNo: 5, paletteLead: "green", pillar: "words", primaryVisual: "map", hookType: "date" }, sb, spec).join("\n");
    expect(text).toMatch(/door No. 5/);
    expect(text).toMatch(/palette lead "green"/);
    expect(text).toMatch(/series "Say It Right"/);
    expect(text).toMatch(/needs a map scene/);
    expect(text).toMatch(/hook "date" but the first sentence names no year/);
  });
  it("catches a music bed that differs from the storyboard's", () => {
    expect(crossCheck({ ...plan, musicBed: "almost-new" }, sb, spec).join("\n")).toMatch(/plan music bed "almost-new" but storyboard audio.music is null/);
  });
  it("says when the primary visual's scene type is not built yet", () => {
    expect(crossCheck({ ...plan, primaryVisual: "character_scene" }, sb, spec).join("\n")).toMatch(/"character_scene" has no scene type yet/);
  });
  it("maps the Phase 5 visuals to their scenes", () => {
    expect(crossCheck({ ...plan, primaryVisual: "ledger_page" }, sb, spec).join("\n")).toMatch(/needs a ledger-page scene/);
    expect(VISUAL_SCENES.flow_diagram).toEqual(["flow-diagram"]);
    expect(VISUAL_SCENES.object_close_up).toEqual(["archival"]);
  });
  it("checks question and surprising-number hooks against the first sentence", () => {
    expect(crossCheck({ ...plan, hookType: "surprising_number" }, sb, spec).join("\n")).toMatch(/says no number/);
  });
});

describe("parseHistory", () => {
  it("reads one plan per line with its publish time, and names a bad line", () => {
    const line = JSON.stringify({ ...planJson, publishedAt: "2026-10-08T00:00:00Z" });
    expect(parseHistory(`${line}\n\n${line}\n`)).toHaveLength(2);
    expect(parseHistory(line)[0].publishedAt).toBe("2026-10-08T00:00:00Z");
    expect(() => parseHistory(`${line}\n{"doorNo": 1}`)).toThrow(/history line 2/);
  });
});

describe("check with a plan", () => {
  it("adds variation and plan-vs-storyboard issues to the storyboard check", async () => {
    const { checkStoryboard } = await import("../../src/skill/check");
    const facts = (await import("../../fixtures/no-004/rule-of-72.facts.json")).default;
    // No. 004 was scripted for the old pacing, so only its word count trips.
    expect(checkStoryboard(sbJson, facts, { variation: { plan: planJson, history: [], spec } }).issues.map((i) => i.message)).toEqual(["script is 158 words (175-215)"]);
    const report = checkStoryboard(sbJson, facts, { variation: { plan: { ...planJson, paletteLead: "green" }, history: [past({ storyShape: "then_to_now" })], spec } });
    expect(report.issues.map((i) => i.stage)).toEqual(["variation", "variation", "plan vs storyboard"]);
  });
});
