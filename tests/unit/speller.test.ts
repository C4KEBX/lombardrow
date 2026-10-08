import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeEdgeProvider, type EdgeDeps } from "../../src/voice/edge";
import { cardinal, foldTimings, ordinalWords, spellNarration, yearWords } from "../../src/voice/speller";

const spoken = (text: string, dict: Record<string, string> = {}) => spellNarration(text, dict).spoken;

describe("cardinal", () => {
  it("says whole numbers the British way", () => {
    expect(cardinal(0)).toBe("zero");
    expect(cardinal(72)).toBe("seventy-two");
    expect(cardinal(105)).toBe("one hundred and five");
    expect(cardinal(1000)).toBe("one thousand");
    expect(cardinal(1005)).toBe("one thousand and five");
    expect(cardinal(7988)).toBe("seven thousand nine hundred and eighty-eight");
    expect(cardinal(2_500_000)).toBe("two million five hundred thousand");
  });
  it("rejects fractions and negatives", () => {
    expect(() => cardinal(1.5)).toThrow(RangeError);
    expect(() => cardinal(-1)).toThrow(RangeError);
  });
});

describe("yearWords", () => {
  it.each([
    [1494, "fourteen ninety-four"],
    [1905, "nineteen oh five"],
    [1900, "nineteen hundred"],
    [2000, "two thousand"],
    [2008, "two thousand and eight"],
    [2025, "twenty twenty-five"],
    [1000, "one thousand"],
  ])("%i is %s", (year, words) => expect(yearWords(year)).toBe(words));
});

describe("ordinalWords", () => {
  it.each([[1, "first"], [2, "second"], [3, "third"], [12, "twelfth"], [20, "twentieth"], [21, "twenty-first"], [100, "one hundredth"]])(
    "%i is %s", (n, words) => expect(ordinalWords(n)).toBe(words),
  );
});

describe("spellNarration", () => {
  it("spells years, money, percents, decimals, decades and ordinals", () => {
    expect(spoken("In 1494, Pacioli wrote it down.")).toBe("In fourteen ninety-four, Pacioli wrote it down.");
    expect(spoken("Put $1,000 in at 8%.")).toBe("Put one thousand dollars in at eight percent.");
    expect(spoken("Just $1.")).toBe("Just one dollar.");
    expect(spoken("A $2 billion loss.")).toBe("A two billion dollars loss.");
    expect(spoken("It took 9.006 years")).toBe("It took nine point zero zero six years");
    expect(spoken("The 1920s roared")).toBe("The nineteen twenties roared");
    expect(spoken("the 19th century")).toBe("the nineteenth century");
    expect(spoken("count 12,500 coins")).toBe("count twelve thousand five hundred coins");
    expect(spoken("(1720)")).toBe("(seventeen twenty)");
  });
  it("leaves words alone and applies the dictionary to the bare token", () => {
    expect(spoken("Lombard Row")).toBe("Lombard Row");
    expect(spoken("Salt & pepper, vs. sugar.", { "&": "and", vs: "versus" })).toBe("Salt and pepper, versus. sugar.");
  });
  it("keeps one group per written token", () => {
    const { groups } = spellNarration("Rule of 72.");
    expect(groups).toEqual([
      { written: "Rule", spoken: "Rule" },
      { written: "of", spoken: "of" },
      { written: "72.", spoken: "seventy-two." },
    ]);
  });
});

describe("foldTimings", () => {
  it("spans each written token over its spoken words", () => {
    const spelled = spellNarration("In 1494 it began");
    const words = foldTimings(spelled, [
      { text: "In", startMs: 0, endMs: 100 },
      { text: "fourteen", startMs: 100, endMs: 400 },
      { text: "ninety-four", startMs: 400, endMs: 800 },
      { text: "it", startMs: 800, endMs: 900 },
      { text: "began", startMs: 900, endMs: 1200 },
    ]);
    expect(words).toEqual([
      { text: "In", startMs: 0, endMs: 100 },
      { text: "1494", startMs: 100, endMs: 800 },
      { text: "it", startMs: 800, endMs: 900 },
      { text: "began", startMs: 900, endMs: 1200 },
    ]);
  });
  it("fails when the spoken word count disagrees", () => {
    expect(() => foldTimings(spellNarration("In 1494"), [{ text: "In", startMs: 0, endMs: 1 }])).toThrow(/spoken words/);
  });
});

describe("Edge provider with the speller", () => {
  it("sends the spoken form to the voice and returns timings on the written tokens", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "speller-"));
    let sent = "";
    const deps: EdgeDeps = {
      runTts: async (args) => {
        const get = (flag: string) => args[args.indexOf(flag) + 1];
        sent = fs.readFileSync(get("--text-file"), "utf-8");
        fs.writeFileSync(get("--out-mp3"), "mp3");
        // Edge merges a spoken number into one event.
        fs.writeFileSync(get("--out-json"), JSON.stringify([
          { text: "Divide", startMs: 0, endMs: 300 },
          { text: "seventy-two", startMs: 300, endMs: 900 },
          { text: "by", startMs: 900, endMs: 1000 },
          { text: "eight", startMs: 1000, endMs: 1300 },
          { text: "percent", startMs: 1300, endMs: 1800 },
        ]));
      },
      probe: async () => 2000,
    };
    const result = await makeEdgeProvider(dir, deps)("Divide 72 by 8%.", "v");
    expect(sent).toBe("Divide seventy-two by eight percent.");
    expect(result.words).toEqual([
      { text: "Divide", startMs: 0, endMs: 300 },
      { text: "72", startMs: 300, endMs: 900 },
      { text: "by", startMs: 900, endMs: 1000 },
      { text: "8%.", startMs: 1000, endMs: 1800 },
    ]);
  });
});
