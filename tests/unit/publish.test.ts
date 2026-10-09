import { describe, expect, it } from "vitest";
import ledgerFacts from "../../fixtures/ledger.facts.json";
import ledgerSb from "../../fixtures/ledger.storyboard.json";
import planJson from "../../fixtures/no-004/plan.json";
import factsJson from "../../fixtures/no-004/rule-of-72.facts.json";
import sbJson from "../../fixtures/no-004/rule-of-72.storyboard.json";
import { renderChecklist } from "../../src/publish/checklist";
import { FOOTER, PHOTOREAL_SCENE_TYPES, YOUTUBE_TITLE_MAX, buildPublishPackage, doorLabel } from "../../src/publish/package";
import { thumbnailTitleSize } from "../../src/publish/Thumbnail";
import { parseAssets } from "../../src/schema/assets";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { buildScriptDoc, renderScriptMarkdown, sentencesOf } from "../../src/skill/scriptDoc";
import { parsePlan } from "../../src/variation/index";

const sb = parseStoryboard(sbJson);
const facts = parseFacts(factsJson);
const plan = parsePlan(planJson);

describe("script with sources", () => {
  const doc = buildScriptDoc(sb, facts);
  const line = (start: string) => doc.lines.find((l) => l.sentence.startsWith(start))!;
  it("splits narration into sentences, keeping questions", () => {
    expect(sentencesOf("Is it accurate? The rule says nine years.")).toEqual(["Is it accurate?", "The rule says nine years."]);
    expect(doc.lines).toHaveLength(sb.scenes.reduce((n, s) => n + sentencesOf(s.narration).length, 0));
  });
  it("names the fact whose number a sentence says", () => {
    expect(line("The exact answer")).toMatchObject({ factIds: ["f-8exact"], basis: "figure" });
    expect(line("It shows up in a book printed in Venice")).toMatchObject({ factIds: ["f-pacioli"], basis: "figure" });
  });
  it("falls back to the scene's facts, and says when a sentence has none", () => {
    expect(line("Luca Pacioli set it down")).toMatchObject({ factIds: ["f-pacioli"], basis: "scene" });
    expect(line("Real returns move")).toMatchObject({ factIds: [], basis: "none" });
  });
  it("renders a table and a fact checklist with links, tiers and corroboration", () => {
    const md = renderScriptMarkdown(doc);
    expect(md).toMatch(/^# No\. 004: The Rule of 72/);
    expect(md).toContain("| caveat | It's an estimate, not a promise. | none named (confirm it states no fact) |");
    expect(md).toContain("- [ ] **f-pacioli**:");
    expect(md).toMatch(/\(scholarly\); also \[Wikipedia: Rule of 72\]\(https:\/\/en\.wikipedia\.org\/wiki\/Rule_of_72\)/);
    expect(md).not.toContain("## Images");
  });
  it("lists the archival images a video uses, with license", () => {
    const assets = parseAssets({ assets: [
      { id: "page-standin", file: "a.jpg", sourceUrl: "https://commons.wikimedia.org/wiki/File:A.jpg", license: "public-domain", credit: "Pacioli, 1494. Public domain.", depicts: "A page" },
      { id: "unused", file: "b.jpg", sourceUrl: "https://commons.wikimedia.org/wiki/File:B.jpg", license: "cc0", credit: "B", depicts: "B" },
    ] });
    const md = renderScriptMarkdown(buildScriptDoc(parseStoryboard(ledgerSb), parseFacts(ledgerFacts), assets));
    expect(md).toContain("- [ ] **page-standin**: A page. Pacioli, 1494. Public domain. ([public-domain](https://commons.wikimedia.org/wiki/File:A.jpg))");
    expect(md).not.toContain("**unused**");
  });
  it("escapes pipes so a sentence cannot break the table", () => {
    const odd = parseStoryboard({ ...sbJson, scenes: sbJson.scenes.map((s, i) => (i === sbJson.scenes.length - 1 ? { ...s, narration: `${s.narration} A | B.` } : s)) });
    expect(renderScriptMarkdown(buildScriptDoc(odd, facts))).toContain("A \\| B.");
  });
});

describe("publish package", () => {
  const pkg = buildPublishPackage(sb, facts, { plan });
  it("uses the plan's title and the same door number on every platform", () => {
    expect(pkg.title).toBe(plan.title);
    expect(doorLabel(4)).toBe("No. 004");
    for (const text of [pkg.youtube.title, pkg.youtube.description, pkg.tiktok.caption, pkg.instagram.caption]) expect(text).toContain("No. 004");
    expect(pkg.youtube.title.length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX);
  });
  it("lists every source link once and ends with the standard footer and tags", () => {
    expect(pkg.sources.map((s) => s.url)).toHaveLength(4);
    for (const text of [pkg.youtube.description, pkg.tiktok.caption, pkg.instagram.caption]) {
      expect(text).toContain(FOOTER);
      for (const s of pkg.sources) expect(text).toContain(s.url);
    }
    expect(FOOTER).toBe("Sources are listed above. Education and history only, not financial, investment, tax or legal advice. Spot an error? Comment and we will correct it.");
  });
  it("leads TikTok with the title and Instagram with the hook", () => {
    expect(pkg.tiktok.caption.split("\n")[0]).toBe(`${plan.title} | Lombard Row No. 004`);
    expect(pkg.instagram.caption.split("\n")[0]).toBe("How long does it take money to double?");
  });
  it("falls back to the storyboard title and shortens a long YouTube title", () => {
    expect(buildPublishPackage(sb, facts).title).toBe("The Rule of 72");
    const long = buildPublishPackage(sb, facts, { plan: { ...plan, title: "x".repeat(120) } });
    expect(long.youtube.title).toHaveLength(YOUTUBE_TITLE_MAX);
  });
  it("needs no AI disclosure: no scene type is photorealistic", () => {
    expect(PHOTOREAL_SCENE_TYPES).toEqual([]);
    expect(pkg.aiDisclosure.required).toBe(false);
  });
  it("credits archival images in the description", () => {
    const assets = parseAssets({ assets: [{ id: "page-standin", file: "a.jpg", sourceUrl: "https://commons.wikimedia.org/wiki/File:A.jpg", license: "public-domain", credit: "Pacioli, 1494. Public domain.", depicts: "A page" }] });
    const p = buildPublishPackage(parseStoryboard(ledgerSb), parseFacts(ledgerFacts), { assets });
    expect(p.youtube.description).toContain("Images:\n- Pacioli, 1494. Public domain. https://commons.wikimedia.org/wiki/File:A.jpg");
  });
  it("steps the thumbnail title down as it gets longer", () => {
    const sizes = [14, 30, 60].map((n) => thumbnailTitleSize("x".repeat(n)));
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
  });
});

describe("pre-publish checklist", () => {
  const pkg = buildPublishPackage(sb, facts, { plan });
  const thumbnails = ["thumb-youtube.png"];
  it("ticks what the pipeline verified and leaves the watch-through to a person", () => {
    const md = renderChecklist(pkg, { durationSeconds: 69.2, variation: [], listenBack: { mismatches: 0, drift: 0 }, thumbnails });
    expect(md).toContain("- [x] Runs 55 to 70 seconds: 69.2 s");
    expect(md).toContain("- [x] Variation check passes");
    expect(md).toContain("- [x] Captions checked word for word");
    expect(md).toContain("- [x] Description has the sources and the standard footer");
    expect(md).toContain("- [ ] Every date, number and name matches a source");
    expect(md).not.toMatch(/FAILED/);
  });
  it("marks failures and checks not yet run", () => {
    const md = renderChecklist(pkg, { durationSeconds: 71.4, variation: ["era repeats"], listenBack: { mismatches: 2, drift: 0 }, thumbnails: [] });
    expect(md).toContain("- [ ] Runs 55 to 70 seconds **FAILED**: 71.4 s");
    expect(md).toContain("**FAILED**: era repeats");
    expect(md).toContain("- [ ] Captions checked word for word: listen closely at the 2 places in listen-back.md (2 words differ, 0 captions out of sync)");
    expect(renderChecklist(pkg, { thumbnails })).toContain("- [ ] Runs 55 to 70 seconds (not checked yet)");
  });
});
