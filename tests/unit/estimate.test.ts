import { describe, expect, it } from "vitest";
import no001Sb from "../../videos/no-001-rule-of-72/storyboard.json";
import { BOOKEND_SECONDS, TARGET_SECONDS, WORDS_PER_SECOND, countWords, estimateSeconds, narrationSeconds, spokenWordCount, targetWords } from "../../src/skill/estimate";

const narrations = (sb: { scenes: { narration: string }[] }) => sb.scenes.map((s) => s.narration);

describe("estimate", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  one  two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("adds only the 3.1 s door plate to the narration: there is no open and no held end", () => {
    expect(BOOKEND_SECONDS).toBeCloseTo(3.1);
    expect(estimateSeconds(["one two three"])).toBeCloseTo(3.1 + narrationSeconds(["one two three"]));
  });
  it("targetWords gives a script length that estimates inside the 62-70 s window, about 195 to 215 words", () => {
    for (const scenes of [6, 8, 10]) {
      const words = targetWords(scenes);
      const even = Array.from({ length: scenes }, () => "w ".repeat(Math.round(words / scenes)).trim());
      const s = estimateSeconds(even);
      expect(s).toBeGreaterThanOrEqual(TARGET_SECONDS.min);
      expect(s).toBeLessThanOrEqual(TARGET_SECONDS.max);
    }
    expect(WORDS_PER_SECOND).toBe(3.34);
    expect(targetWords(8)).toBeGreaterThanOrEqual(195);
    expect(targetWords(8)).toBeLessThanOrEqual(215);
  });
  it("matches No. 001's measured narration in en-GB-RyanNeural (63.4 s, 2026-10-09) within 3 percent", () => {
    const measured = 63.4;
    expect(Math.abs(narrationSeconds(narrations(no001Sb)) - measured) / measured).toBeLessThan(0.03);
  });
});

describe("spokenWordCount", () => {
  it("counts the words the voice says, not the digits written", () => {
    expect(spokenWordCount("In 1494 it began")).toBe(5);
    expect(spokenWordCount("Up 8% to $1,000.")).toBe(7);
    expect(spokenWordCount("Plain words only")).toBe(3);
  });
});
