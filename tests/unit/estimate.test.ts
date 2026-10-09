import { describe, expect, it } from "vitest";
import no001Sb from "../../videos/no-001-rule-of-72/storyboard.json";
import { BOOKEND_SECONDS, TARGET_SECONDS, WORDS_PER_SECOND, countWords, estimateSeconds, narrationSeconds, spokenWordCount, targetWords } from "../../src/skill/estimate";

const narrations = (sb: { scenes: { narration: string }[] }) => sb.scenes.map((s) => s.narration);

describe("estimate", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  one  two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("adds only the measured 4.6 s door plate to the narration: there is no open", () => {
    expect(BOOKEND_SECONDS).toBeCloseTo(4.6);
    expect(estimateSeconds(["one two three"])).toBeCloseTo(4.6 + narrationSeconds(["one two three"]));
  });
  it("targetWords gives a script length that estimates inside the 55-70 s window, about 175 to 190 words", () => {
    for (const scenes of [6, 8, 10]) {
      const words = targetWords(scenes);
      const even = Array.from({ length: scenes }, () => "w ".repeat(Math.round(words / scenes)).trim());
      const s = estimateSeconds(even);
      expect(s).toBeGreaterThanOrEqual(TARGET_SECONDS.min);
      expect(s).toBeLessThanOrEqual(TARGET_SECONDS.max);
    }
    expect(WORDS_PER_SECOND).toBe(3.26);
    expect(targetWords(8)).toBeGreaterThanOrEqual(175);
    expect(targetWords(8)).toBeLessThanOrEqual(190);
  });
  it("matches No. 001's measured narration in en-GB-RyanNeural (50.3 s) within 2 percent", () => {
    const measured = 50.3;
    expect(Math.abs(narrationSeconds(narrations(no001Sb)) - measured) / measured).toBeLessThan(0.02);
  });
});

describe("spokenWordCount", () => {
  it("counts the words the voice says, not the digits written", () => {
    expect(spokenWordCount("In 1494 it began")).toBe(5);
    expect(spokenWordCount("Up 8% to $1,000.")).toBe(7);
    expect(spokenWordCount("Plain words only")).toBe(3);
  });
});
