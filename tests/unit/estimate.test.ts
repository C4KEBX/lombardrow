import { describe, expect, it } from "vitest";
import financeSb from "../../fixtures/finance.storyboard.json";
import historySb from "../../fixtures/history.storyboard.json";
import ancientSb from "../../fixtures/ancient.storyboard.json";
import inflationSb from "../../fixtures/calibration/us-inflation.storyboard.json";
import ruleSb from "../../fixtures/calibration/rule-of-72.storyboard.json";
import romanSb from "../../fixtures/calibration/roman-republic.storyboard.json";
import no004Sb from "../../fixtures/no-004/rule-of-72.storyboard.json";
import { ANDREW_WORDS_PER_SECOND, BOOKEND_SECONDS, TARGET_SECONDS, WORDS_PER_SECOND, countWords, estimateSeconds, narrationSeconds, spokenWordCount, targetWords } from "../../src/skill/estimate";

const narrations = (sb: { scenes: { narration: string }[] }) => sb.scenes.map((s) => s.narration);

describe("estimate", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  one  two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("matches the measured narration lengths of the six real en-US-AndrewNeural runs within 12 percent", () => {
    const measured: [{ scenes: { narration: string }[] }, number][] = [
      [financeSb, 22.9], [historySb, 20.9], [ancientSb, 29.6], [inflationSb, 57.3], [ruleSb, 57.5], [romanSb, 58.9],
    ];
    for (const [sb, seconds] of measured) {
      expect(Math.abs(narrationSeconds(narrations(sb), ANDREW_WORDS_PER_SECOND) - seconds) / seconds).toBeLessThan(0.12);
    }
  });
  it("adds the 2 s open and the measured 4.6 s door plate to the narration", () => {
    expect(BOOKEND_SECONDS).toBeCloseTo(6.6);
    expect(estimateSeconds(["one two three"])).toBeCloseTo(6.6 + narrationSeconds(["one two three"]));
  });
  it("targetWords gives a script length that estimates inside the 65-70 s window, about 145 to 165 words", () => {
    for (const scenes of [6, 8, 10]) {
      const words = targetWords(scenes);
      const even = Array.from({ length: scenes }, () => "w ".repeat(Math.round(words / scenes)).trim());
      const s = estimateSeconds(even);
      expect(s).toBeGreaterThanOrEqual(TARGET_SECONDS.min);
      expect(s).toBeLessThanOrEqual(TARGET_SECONDS.max);
    }
    expect(WORDS_PER_SECOND).toBe(2.66);
    expect(targetWords(8)).toBeGreaterThanOrEqual(145);
    expect(targetWords(8)).toBeLessThanOrEqual(165);
  });
  it("matches the real en-GB-RyanNeural run of No. 004 (69.2 s) within 2 percent", () => {
    expect(Math.abs(estimateSeconds(narrations(no004Sb)) - 69.2) / 69.2).toBeLessThan(0.02);
  });
});

describe("spokenWordCount", () => {
  it("counts the words the voice says, not the digits written", () => {
    expect(spokenWordCount("In 1494 it began")).toBe(5);
    expect(spokenWordCount("Up 8% to $1,000.")).toBe(7);
    expect(spokenWordCount("Plain words only")).toBe(3);
  });
});
