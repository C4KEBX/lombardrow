import { describe, expect, it } from "vitest";
import financeSb from "../../fixtures/finance.storyboard.json";
import historySb from "../../fixtures/history.storyboard.json";
import ancientSb from "../../fixtures/ancient.storyboard.json";
import inflationSb from "../../fixtures/calibration/us-inflation.storyboard.json";
import ruleSb from "../../fixtures/calibration/rule-of-72.storyboard.json";
import romanSb from "../../fixtures/calibration/roman-republic.storyboard.json";
import { TARGET_SECONDS, WORDS_PER_SECOND, countWords, estimateSeconds, targetWords } from "../../src/skill/estimate";

const narrations = (sb: { scenes: { narration: string }[] }) => sb.scenes.map((s) => s.narration);

describe("estimate", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  one  two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("matches the measured real-voice lengths of the six real runs within 12 percent", () => {
    const measured: [{ scenes: { narration: string }[] }, number][] = [
      [financeSb, 22.9], [historySb, 20.9], [ancientSb, 29.6], [inflationSb, 57.3], [ruleSb, 57.5], [romanSb, 58.9],
    ];
    for (const [sb, seconds] of measured) {
      expect(Math.abs(estimateSeconds(narrations(sb)) - seconds) / seconds).toBeLessThan(0.12);
    }
  });
  it("targetWords gives a script length that estimates inside the 55-60 s window", () => {
    for (const scenes of [6, 8, 10]) {
      const words = targetWords(scenes);
      const even = Array.from({ length: scenes }, () => "w ".repeat(Math.round(words / scenes)).trim());
      const s = estimateSeconds(even);
      expect(s).toBeGreaterThanOrEqual(TARGET_SECONDS.min);
      expect(s).toBeLessThanOrEqual(TARGET_SECONDS.max);
    }
    expect(WORDS_PER_SECOND).toBe(2.85);
  });
});
