import { describe, expect, it } from "vitest";
import { normalizeWord, resolveCue, type WordTiming } from "../../src/schema/timing";

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

describe("normalizeWord keeps decimals distinct from integers", () => {
  it("keeps a decimal point between digits", () => {
    expect(normalizeWord("$1.5")).toBe("1.5");
    expect(normalizeWord("56.8")).toBe("56.8");
    expect(normalizeWord("3.14.")).toBe("3.14");
  });
  it("strips thousands separators and other punctuation", () => {
    expect(normalizeWord("1,200")).toBe("1200");
    expect(normalizeWord("57%")).toBe("57");
    expect(normalizeWord("value.")).toBe("value");
    expect(normalizeWord("S&P")).toBe("sp");
    expect(normalizeWord("U.S.")).toBe("us");
  });
  it("no longer lets '$1.5' and '15' collide", () => {
    expect(normalizeWord("$1.5")).not.toBe(normalizeWord("15"));
    const words = [w("15", 0, 300), w("$1.5", 300, 800)];
    expect(resolveCue(words, "1.5")).toBe(300);
    expect(resolveCue(words, "15")).toBe(0);
  });
  it("treats '2,007' and '2007' as the same token", () => {
    expect(normalizeWord("2,007")).toBe(normalizeWord("2007"));
  });
});
