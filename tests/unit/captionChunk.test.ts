import { describe, expect, it } from "vitest";
import {
  CAPTION_HOLD_MS, activeWordIndex, buildCaptions, chunkAt, chunkWords, type CaptionWord,
} from "../../src/captions/chunk";

const w = (text: string, startMs: number, endMs: number): CaptionWord => ({ text, startMs, endMs });
const texts = (c: { words: CaptionWord[] }) => c.words.map((x) => x.text);

describe("chunkWords", () => {
  it("returns an empty list for no words", () => {
    expect(chunkWords([])).toEqual([]);
  });
  it("groups up to 4 words", () => {
    const words = ["a", "b", "c", "d", "e"].map((t, i) => w(t, i * 300, i * 300 + 250));
    expect(chunkWords(words).map(texts)).toEqual([["a", "b", "c", "d"], ["e"]]);
  });
  it("breaks before a word that would exceed 24 characters", () => {
    const words = [w("International", 0, 400), w("Business", 450, 800), w("Machines", 850, 1200)];
    expect(chunkWords(words).map(texts)).toEqual([["International", "Business"], ["Machines"]]);
  });
  it("breaks after sentence-ending punctuation", () => {
    const words = [w("Stocks", 0, 300), w("fell.", 320, 600), w("Then", 650, 900), w("rose", 920, 1200)];
    expect(chunkWords(words).map(texts)).toEqual([["Stocks", "fell."], ["Then", "rose"]]);
  });
  it("breaks across a long pause", () => {
    const words = [w("one", 0, 300), w("two", 1200, 1500)];
    expect(chunkWords(words).map(texts)).toEqual([["one"], ["two"]]);
  });
  it("puts a single over-long word in its own chunk", () => {
    const words = [w("a", 0, 100), w("Pneumonoultramicroscopicsilico", 120, 900), w("b", 920, 1000)];
    expect(chunkWords(words).map(texts)).toEqual([["a"], ["Pneumonoultramicroscopicsilico"], ["b"]]);
  });
  it("holds a chunk briefly after its last word but never into the next chunk", () => {
    const words = [w("one", 0, 300), w("two", 1200, 1500), w("three", 1550, 1800)];
    const [a, b] = chunkWords(words);
    expect(a.endMs).toBe(300 + CAPTION_HOLD_MS);
    expect(b.startMs).toBe(1200);
    const tight = chunkWords([w("x.", 0, 300), w("y", 320, 600)]);
    expect(tight[0].endMs).toBe(320);
  });
  it("does not mutate its input", () => {
    const words = [w("a", 0, 100), w("b", 120, 300)];
    const before = JSON.stringify(words);
    chunkWords(words);
    expect(JSON.stringify(words)).toBe(before);
  });
});

describe("chunkAt and activeWordIndex", () => {
  const chunks = chunkWords([w("one", 100, 300), w("two", 320, 600), w("three.", 620, 900)]);
  it("finds the chunk showing at a time, if any", () => {
    expect(chunkAt(chunks, 50)).toBeUndefined();
    expect(chunkAt(chunks, 100)).toBe(chunks[0]);
    expect(chunkAt(chunks, 900 + CAPTION_HOLD_MS - 1)).toBe(chunks[0]);
    expect(chunkAt(chunks, 900 + CAPTION_HOLD_MS)).toBeUndefined();
  });
  it("tracks the word being spoken and keeps earlier words spoken", () => {
    expect(activeWordIndex(chunks[0], 99)).toBe(-1);
    expect(activeWordIndex(chunks[0], 100)).toBe(0);
    expect(activeWordIndex(chunks[0], 330)).toBe(1);
    expect(activeWordIndex(chunks[0], 5000)).toBe(2);
  });
});

describe("buildCaptions", () => {
  it("shifts scene-local words onto the global timeline", () => {
    const captions = buildCaptions(
      [
        { startFrame: 0, words: [w("one", 0, 300)] },
        { startFrame: 30, words: [w("two", 100, 400)] },
      ],
      30,
    );
    expect(captions.flatMap((c) => c.words.map((x) => [x.text, x.startMs]))).toEqual([["one", 0], ["two", 1100]]);
  });
});
