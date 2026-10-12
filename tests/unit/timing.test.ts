import { describe, expect, it } from "vitest";
import {
  CueResolutionError,
  msToFrame,
  normalizeWord,
  resolveCue,
  sceneDurationMs,
  type WordTiming,
} from "../../src/schema/timing";

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

const words = [
  w("It", 0, 150), w("lost", 150, 500), w("more", 500, 800), w("than", 800, 1000),
  w("half", 1000, 1500), w("of", 1500, 1650), w("its", 1650, 1800), w("value.", 1800, 2300),
];

describe("normalizeWord", () => {
  it("lowercases and strips punctuation and symbols", () => {
    expect(normalizeWord("S&P")).toBe("sp");
    expect(normalizeWord("57%")).toBe("57");
    expect(normalizeWord("$1.5")).toBe("1.5");
    expect(normalizeWord("value.")).toBe("value");
  });
  it("keeps non-ASCII letters", () => {
    expect(normalizeWord("Café")).toBe("café");
  });
});

describe("resolveCue", () => {
  it("returns the start of the matching word", () => {
    expect(resolveCue(words, "half")).toBe(1000);
  });
  it("matches regardless of case and trailing punctuation", () => {
    expect(resolveCue(words, "VALUE")).toBe(1800);
  });
  it("picks the requested occurrence of a repeated word", () => {
    const rep = [w("the", 0, 100), w("market", 100, 400), w("the", 400, 500), w("crash", 500, 900)];
    expect(resolveCue(rep, "the")).toBe(0);
    expect(resolveCue(rep, "the", 2)).toBe(400);
  });
  it("matches symbol-heavy tokens against their cue words", () => {
    const sym = [w("S&P", 0, 300), w("fell", 300, 600), w("57%", 600, 1100), w("to", 1100, 1200), w("$1.5", 1200, 1700)];
    expect(resolveCue(sym, "S&P")).toBe(0);
    expect(resolveCue(sym, "57")).toBe(600);
    expect(resolveCue(sym, "1.5")).toBe(1200);
  });
  it("throws a clear error when the cue word is not in the narration", () => {
    expect(() => resolveCue(words, "crash")).toThrow(CueResolutionError);
    expect(() => resolveCue(words, "crash")).toThrow(/"crash".*not found/);
  });
  it("throws when the requested occurrence does not exist", () => {
    expect(() => resolveCue(words, "half", 2)).toThrow(/occurrence 2/);
  });
  it("throws when the cue word has no letters or digits", () => {
    expect(() => resolveCue(words, "...")).toThrow(/no letters or digits/);
  });
  it("throws when there are no word timings", () => {
    expect(() => resolveCue([], "half")).toThrow(CueResolutionError);
  });
});

describe("msToFrame", () => {
  it("converts milliseconds to the nearest frame", () => {
    expect(msToFrame(1000, 30)).toBe(30);
    expect(msToFrame(2600, 30)).toBe(78);
    expect(msToFrame(0, 30)).toBe(0);
  });
});

describe("sceneDurationMs", () => {
  it("is the last word end plus the tail pad", () => {
    expect(sceneDurationMs(words)).toBe(2300 + 200);
    expect(sceneDurationMs(words, 1000)).toBe(3300);
  });
  it("throws on empty word timings", () => {
    expect(() => sceneDurationMs([])).toThrow(CueResolutionError);
  });
});
