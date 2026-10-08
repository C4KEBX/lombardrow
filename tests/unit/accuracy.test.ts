import { describe, expect, it } from "vitest";
import no004Facts from "../../fixtures/no-004/rule-of-72.facts.json";
import no004Sb from "../../fixtures/no-004/rule-of-72.storyboard.json";
import { figureMatches, figuresIn } from "../../src/schema/figures";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { assertDisputedHedged, assertSources, assertSpokenFigures, factNumbers } from "../../src/schema/validate";
import { adviceLint, tickerHits } from "../../src/skill/adviceLint";
import { checkStoryboard } from "../../src/skill/check";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const values = (text: string) => figuresIn(text).map((f) => f.value);

describe("figuresIn", () => {
  it("reads digits, money, percents, decades and ordinals", () => {
    expect(values("In 1494, $1,000 grew 8% to 9.006 in the 1920s and the 19th century.")).toEqual([1494, 1000, 8, 9.006, 1920, 19]);
  });
  it("reads spelled-out cardinals, years and decimals", () => {
    expect(values("fourteen ninety-four")).toEqual([1494]);
    expect(values("nineteen oh five")).toEqual([1905]);
    expect(values("twenty twenty-five")).toEqual([2025]);
    expect(values("nineteen hundred")).toEqual([1900]);
    expect(values("two thousand and eight")).toEqual([2008]);
    expect(values("seven thousand nine hundred and eighty-eight")).toEqual([7988]);
    expect(values("a thousand dollars")).toEqual([1000]);
    expect(values("over five hundred years")).toEqual([500]);
    expect(values("nine point zero zero six")).toEqual([9.006]);
    expect(values("seventy two over eight is nine")).toEqual([72, 8, 9]);
    expect(values("forty seven hundred")).toEqual([4700]);
  });
  it("splits figures at punctuation and ignores a lone 'one', 'a' and 'and'", () => {
    expect(values("two thousand in nine years, four thousand in eighteen, and eight thousand")).toEqual([2000, 9, 4000, 18, 8000]);
    expect(values("one idea, a book and salt and pepper")).toEqual([]);
  });
});

describe("figureMatches", () => {
  it("accepts exact values and one or two significant-figure roundings", () => {
    expect(figureMatches(9.006, 9.006)).toBe(true);
    expect(figureMatches(2000, 1999)).toBe(true);
    expect(figureMatches(4000, 3996)).toBe(true);
    expect(figureMatches(500, 532)).toBe(true);
    expect(figureMatches(9, 9.006)).toBe(true);
    expect(figureMatches(4700, 4769)).toBe(false);
    expect(figureMatches(7, 9)).toBe(false);
  });
});

describe("spoken figures", () => {
  const facts = parseFacts(no004Facts);
  it("pass on No. 004, where every figure names its fact", () => {
    expect(() => assertSpokenFigures(parseStoryboard(no004Sb), facts)).not.toThrow();
  });
  it("fail on a figure no named fact states, and point at the fact that does", () => {
    const sb = clone(no004Sb);
    delete (sb.scenes[2] as { speaks?: string[] }).speaks;
    expect(() => assertSpokenFigures(parseStoryboard(sb), facts)).toThrow(/"rule".*"seventy two" \(fact "f-.*" states it: add it to "speaks"\)/);
  });
  it("fail on a figure no fact states at all", () => {
    const sb = clone(no004Sb);
    sb.scenes[5].narration = "It's an estimate. Real returns fell 37% in 2008.";
    expect(() => assertSpokenFigures(parseStoryboard(sb), facts)).toThrow(/"37%".*no fact states it.*"2008"/);
  });
  it("read the numbers a fact states from its value, dataset and claim", () => {
    const growth = facts.facts.find((f) => f.id === "f-growth")!;
    expect(factNumbers(growth)).toEqual(expect.arrayContaining([1000, 1999, 3996, 7988, 27, 8]));
  });
});

describe("source rules", () => {
  type FactsIn = typeof no004Facts;
  it("pass on No. 004: three sites, scholarly and primary, secondary corroborated", () => {
    expect(() => assertSources(parseFacts(no004Facts))).not.toThrow();
  });
  it("require a tier on every source", () => {
    const f = clone(no004Facts) as FactsIn;
    delete (f.facts[1].source as { tier?: string }).tier;
    expect(() => assertSources(parseFacts(f))).toThrow(/"f-growth" source has no tier/);
  });
  it("require a second independent site behind a secondary source", () => {
    const f = clone(no004Facts) as FactsIn;
    f.facts[0].source.tier = "secondary";
    f.facts[0].corroboration = [{ name: "Same site", url: "https://www.cambridge.org/other", tier: "secondary" }];
    expect(() => assertSources(parseFacts(f))).toThrow(/"f-pacioli" rests on a secondary source/);
  });
  it("require at least three sites and one primary or scholarly source", () => {
    const f = clone(no004Facts) as FactsIn;
    for (const fact of f.facts) {
      fact.source.tier = "secondary";
      fact.source.url = "https://en.wikipedia.org/wiki/Rule_of_72";
      delete (fact as { corroboration?: unknown }).corroboration;
    }
    const message = (() => { try { assertSources(parseFacts(f)); return ""; } catch (e) { return (e as Error).message; } })();
    expect(message).toMatch(/cites 1 site/);
    expect(message).toMatch(/no primary or scholarly source/);
  });
});

describe("disputed facts", () => {
  const disputedFacts = () => {
    const f = clone(no004Facts);
    (f.facts[0] as { disputed?: boolean }).disputed = true;
    return parseFacts(f);
  };
  it("must be labelled in the narration of every scene that uses them", () => {
    expect(() => assertDisputedHedged(parseStoryboard(no004Sb), disputedFacts())).toThrow(/"hook" uses disputed fact "f-pacioli"/);
  });
  it("pass when the scene hedges", () => {
    const sb = clone(no004Sb);
    for (const s of sb.scenes) s.narration = `The popular story is this. ${s.narration}`;
    expect(() => assertDisputedHedged(parseStoryboard(sb), disputedFacts())).not.toThrow();
  });
});

describe("advice and tickers", () => {
  const withNarration = (text: string) => {
    const sb = clone(no004Sb);
    sb.scenes[0].narration = text;
    return parseStoryboard(sb);
  };
  it("flags the Do/Don't table's phrasing", () => {
    for (const text of [
      "You need to start investing now or you'll regret it.",
      "This one weird trick banks don't want you to know.",
      "Experts say credit scores are important.",
      "I'm going to tell you the best way to pay off debt.",
      "As a financial advisor, I see this a lot.",
      "It happened a long time ago.",
    ]) expect(adviceLint(withNarration(text)).length, text).toBeGreaterThan(0);
  });
  it("leaves the Do column alone", () => {
    for (const text of [
      "Banks charge interest on interest. Here's where that idea came from.",
      "There are two common ways people pay off debt. Here's how each one works.",
    ]) expect(adviceLint(withNarration(text)), text).toEqual([]);
  });
  it("blocks tickers spoken or on screen, but not money units", () => {
    expect(tickerHits(withNarration("Shares of $AAPL rose."))).toEqual([{ sceneId: "hook", ticker: "$AAPL" }]);
    expect(tickerHits(withNarration("It listed as NYSE: GE in 1892."))[0].ticker).toBe("NYSE: GE");
    expect(tickerHits(withNarration("Worth $2B then, or about $5 billion now."))).toEqual([]);
    const sb = clone(no004Sb);
    (sb.scenes[3].props as { title: string }).title = "$TSLA vs savings";
    const report = checkStoryboard(sb, no004Facts);
    expect(report.issues).toContainEqual({ stage: "tickers", message: expect.stringMatching(/"growth".*"\$TSLA"/) });
  });
});
