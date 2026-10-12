import { describe, expect, it } from "vitest";
import { makeSentenceProvider, sentenceOffsets, splitSentences } from "../../src/voice/sentences";
import { synthWords } from "../../src/voice/synthWords";
import type { VoiceProvider } from "../../src/voice/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("splitSentences", () => {
  it("splits on full stops, questions and exclamations, keeping every word", () => {
    const text = "How long does it take money to double? Lenders have used a shortcut. Seventy-two!";
    const parts = splitSentences(text);
    expect(parts).toEqual(["How long does it take money to double?", "Lenders have used a shortcut.", "Seventy-two!"]);
    expect(parts.join(" ")).toBe(text);
  });
  it("splits the sign-off into its two separate words", () => {
    expect(splitSentences("Lombard. Row. How money got this way.")).toEqual(["Lombard.", "Row.", "How money got this way."]);
  });
  it("does not split on decimals or common abbreviations", () => {
    expect(splitSentences("It grew 1.5 times, e.g. in No. 4 here.")).toHaveLength(1);
  });
});

describe("sentenceOffsets", () => {
  it("leaves the same short gap between every pair of sentences", () => {
    const parts = [
      { words: [{ text: "a", startMs: 100, endMs: 900 }] },
      { words: [{ text: "b", startMs: 100, endMs: 600 }] },
    ];
    const [first, second] = sentenceOffsets(parts, 300);
    expect(first).toBe(0);
    expect(second + 100 - 900).toBe(300);
  });
});

describe("makeSentenceProvider", () => {
  it("voices each sentence, joins them once, and shifts the word timings", async () => {
    const calls: string[] = [];
    const inner: VoiceProvider = async (narration) => {
      calls.push(narration);
      const words = synthWords(narration).map((w) => ({ ...w, startMs: w.startMs + 100, endMs: w.endMs + 100 }));
      return { audioPath: `/clips/${narration}.mp3`, words, audioMs: words[words.length - 1].endMs + 900 };
    };
    const joins: number[][] = [];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentences-"));
    const provider = makeSentenceProvider(inner, dir, {
      join: async (_clips, offsets, out) => { joins.push([...offsets]); fs.writeFileSync(out, ""); },
      probe: async () => 4321,
    });
    const result = await provider("One two three. Four five.", "v");
    expect(calls.slice(0, 2)).toEqual(["One two three.", "Four five."]);
    expect(result.words.map((w) => w.text)).toEqual(["One", "two", "three.", "Four", "five."]);
    expect(result.words[3].startMs - result.words[2].endMs).toBe(300);
    expect(result.audioMs).toBe(4321);
    await provider("One two three. Four five.", "v");
    expect(joins).toHaveLength(1); // cached
    const single = await provider("Just one sentence.", "v");
    expect(single.audioPath).toMatch(/^\/clips\//);
  });
});
