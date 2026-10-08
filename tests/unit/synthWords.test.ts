import { describe, expect, it } from "vitest";
import { synthWords } from "../../src/voice/standin";

describe("synthWords (stand-in for TTS word timings)", () => {
  it("returns one ordered, finite timing per whitespace-separated token", () => {
    const words = synthWords("The index fell, then climbed.");
    expect(words.map((w) => w.text)).toEqual(["The", "index", "fell,", "then", "climbed."]);
    let prev = -1;
    for (const w of words) {
      expect(Number.isFinite(w.startMs) && Number.isFinite(w.endMs)).toBe(true);
      expect(w.endMs).toBeGreaterThan(w.startMs);
      expect(w.startMs).toBeGreaterThan(prev);
      prev = w.startMs;
    }
  });
  it("makes longer words last longer", () => {
    const [short, long] = synthWords("a extraordinarily");
    expect(long.endMs - long.startMs).toBeGreaterThan(short.endMs - short.startMs);
  });
  it("returns an empty list for blank narration", () => {
    expect(synthWords("   ")).toEqual([]);
  });
});
