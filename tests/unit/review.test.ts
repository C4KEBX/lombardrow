import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { factTokens } from "../../src/skill/verifyFacts";
import { buildReviewModel, escapeHtml, renderReviewHtml } from "../../src/skill/review";

const sb = parseStoryboard(storyboard);
const fx = parseFacts(facts);
const images = Object.fromEntries(sb.scenes.map((s) => [s.id, `data:image/png;base64,AAAA`]));

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});

describe("buildReviewModel", () => {
  const model = buildReviewModel(sb, fx, { images });

  it("lists every scene with narration, cues, fact ids and its image", () => {
    expect(model.scenes.map((s) => s.id)).toEqual(sb.scenes.map((s) => s.id));
    const sp = model.scenes.find((s) => s.id === "sp500")!;
    expect(sp.factIds).toEqual(["f-sp"]);
    expect(sp.cues.join(" ")).toMatch(/callout.*2008: 903/);
    expect(sp.image).toBe(images.sp500);
  });

  it("warns about untraced on-screen text: title digits, callout text, chart titles", () => {
    const text = model.warnings.join("\n");
    expect(text).toMatch(/Scene "intro" \(title\).*17 Years of the S&P 500/);
    expect(text).toMatch(/Scene "sp500" callout "2008: 903" is not traced to a fact/);
  });

  it("flags placeholder facts (demo data) and unused facts", () => {
    expect(model.facts.find((f) => f.id === "f-sp")!.flags.join(" ")).toMatch(/placeholder/i);
    const extra = parseFacts({ facts: [...fx.facts, { id: "f-unused", claim: "c", value: 1, source: { name: "n", url: "https://example.com/" } }] });
    const m = buildReviewModel(sb, extra, { images });
    expect(m.warnings.join("\n")).toMatch(/fact "f-unused" is not used by any scene/);
  });

  it("turns verify results into per-fact status and warnings for anything not supported", () => {
    const m = buildReviewModel(sb, fx, {
      images,
      verify: [
        { factId: "f-sp", url: "https://x.test/", status: "supported", found: factTokens(fx.facts.find((f) => f.id === "f-sp")!).filter((t) => !t.includes(",")), missing: [] },
        { factId: "f-drop", url: "https://x.test/", status: "not-found", found: [], missing: ["57"] },
      ],
    });
    expect(m.facts.find((f) => f.id === "f-sp")!.verify).toBe("supported");
    expect(m.warnings.join("\n")).toMatch(/fact "f-drop".*not-found/);
    expect(m.warnings.join("\n")).not.toMatch(/fact "f-sp".*supported/);
  });
});

describe("stale verify results and untraced labels", () => {
  it("marks a verify result stale when the fact's numbers changed after it was run", () => {
    const m = buildReviewModel(sb, fx, {
      images,
      verify: [{ factId: "f-drop", url: "https://x.test/", status: "supported", found: ["58"], missing: [] }],
    });
    expect(m.facts.find((f) => f.id === "f-drop")!.verify).toBe("stale");
    expect(m.warnings.join("\n")).toMatch(/fact "f-drop" source check is stale/);
    const fresh = buildReviewModel(sb, fx, {
      images,
      verify: [{ factId: "f-drop", url: "https://x.test/", status: "supported", found: ["57"], missing: [] }],
    });
    expect(fresh.facts.find((f) => f.id === "f-drop")!.verify).toBe("supported");
  });

  it("warns about digits in big-number labels, compare labels and quote attributions", () => {
    const board = parseStoryboard({
      schemaVersion: 1,
      meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
      audio: { music: null },
      scenes: [
        { id: "n", type: "big-number", narration: "x", props: { value: 5, label: "since 1999", factId: "f" } },
        { id: "c", type: "compare", narration: "y", props: { title: "T", left: { label: "Dec 2021", value: 1, factId: "f" }, right: { label: "Other", value: 2, factId: "f" } } },
      ],
    });
    const f = parseFacts({ facts: [{ id: "f", claim: "c", value: 5, source: { name: "n", url: "https://example.com/" } }] });
    const text = buildReviewModel(board, f, { images: {} }).warnings.join("\n");
    expect(text).toMatch(/Scene "n" \(big-number\) label.*since 1999/);
    expect(text).toMatch(/Scene "c" \(compare\) label.*Dec 2021/);
  });
});

describe("renderReviewHtml", () => {
  it("escapes model-written text everywhere and never emits a script tag or javascript: link", () => {
    const evilSb = parseStoryboard({
      schemaVersion: 1,
      meta: { title: "<script>alert(1)</script>", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
      audio: { music: null },
      scenes: [{ id: "s", type: "title", narration: `Hi <img src=x onerror=alert(1)> "quoted"`, props: { headline: "<b>H</b>" } }],
    });
    const evilFacts = parseFacts({
      facts: [{ id: "f", claim: `<script>x()</script>`, value: 1, source: { name: `"><script>`, url: "https://example.com/?a=1&b=<2>" } }],
    });
    const html = renderReviewHtml(buildReviewModel(evilSb, evilFacts, { images: { s: "data:image/png;base64,AAAA" } }));
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('href="https://example.com/?a=1&amp;b=&lt;2&gt;"');
  });

  it("only links http(s) source URLs; embeds the stills as data URIs; is a complete document", () => {
    const html = renderReviewHtml(buildReviewModel(sb, fx, { images }));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect((html.match(/<img /g) ?? []).length).toBe(sb.scenes.length);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain("Content-Security-Policy");
  });

  it("refuses an image that is not a PNG data URI", () => {
    const bad = buildReviewModel(sb, fx, { images: { ...images, intro: "https://evil.test/x.png" } });
    expect(() => renderReviewHtml(bad)).toThrow(/data URI/);
  });
});
