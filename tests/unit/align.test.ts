import { describe, expect, it } from "vitest";
import { VoiceAlignmentError, alignEvents, spokenWeight, type RawEvent } from "../../src/voice/align";
import { assertValidWords } from "../../src/schema/timing";
import { synthWords } from "../../src/voice/synthWords";

const ev = (text: string, startMs: number, endMs: number): RawEvent => ({ text, startMs, endMs });
const byText = (words: { text: string; startMs: number; endMs: number }[], text: string) =>
  words.find((w) => w.text === text)!;

describe("spokenWeight", () => {
  it("weights letters 1, digits 2, % and $ 6, & 3, and never below 1", () => {
    expect(spokenWeight("In")).toBe(2);
    expect(spokenWeight("2008,")).toBe(8);
    expect(spokenWeight("57%")).toBe(10);
    expect(spokenWeight("$700")).toBe(12);
    expect(spokenWeight("S&P")).toBe(5);
    expect(spokenWeight("...")).toBe(1);
  });
});

describe("alignEvents with one event per word", () => {
  it("passes timings through and keeps the narration's own token text", () => {
    const words = alignEvents("Stocks fell today.", [
      ev("Stocks", 100, 500), ev("fell", 500, 800), ev("today", 800, 1300),
    ]);
    expect(words).toEqual([
      { text: "Stocks", startMs: 100, endMs: 500 },
      { text: "fell", startMs: 500, endMs: 800 },
      { text: "today.", startMs: 800, endMs: 1300 },
    ]);
  });
});

describe("alignEvents splits merged number events", () => {
  const narration = "In 2008, the market fell 57% by March 2009.";
  const events = [
    ev("In 2008", 0, 1000), ev("the", 1000, 1200), ev("market", 1200, 1700), ev("fell", 1700, 2000),
    ev("57%", 2000, 2800), ev("by", 2800, 3000), ev("March 2009", 3000, 4400),
  ];
  it("returns one timing per narration token", () => {
    expect(alignEvents(narration, events).map((w) => w.text)).toEqual(
      ["In", "2008,", "the", "market", "fell", "57%", "by", "March", "2009."],
    );
  });
  it("splits a merged event proportionally to spoken weight and keeps its total span", () => {
    const words = alignEvents(narration, events);
    const inn = byText(words, "In");
    const year = byText(words, "2008,");
    expect(inn.startMs).toBe(0);
    expect(inn.endMs).toBeCloseTo(200, 6); // weight 2 of 10
    expect(year.startMs).toBeCloseTo(200, 6);
    expect(year.endMs).toBeCloseTo(1000, 6);
    const march = byText(words, "March");
    expect(march.startMs).toBe(3000);
    expect(march.endMs).toBeCloseTo(3000 + (1400 * 5) / 13, 6);
    expect(byText(words, "2009.").endMs).toBeCloseTo(4400, 6);
  });
  it("produces ordered, finite, valid timings", () => {
    expect(() => assertValidWords(alignEvents(narration, events))).not.toThrow();
  });
  it("splits a long merged money phrase by weight", () => {
    const text = "It rose from $1.5 trillion to $700 billion in 12 months.";
    const words = alignEvents(text, [
      ev("It", 0, 200), ev("rose", 200, 500), ev("from", 500, 800),
      ev("$1.5 trillion to $700 billion", 800, 4000),
      ev("in", 4000, 4200), ev("12", 4200, 4700), ev("months.", 4700, 5200),
    ]);
    // weights: $1.5 = 10, trillion = 8, to = 2, $700 = 12, billion = 7 (total 39) over 3200 ms
    const unit = 3200 / 39;
    expect(byText(words, "$1.5")).toMatchObject({ startMs: 800 });
    expect(byText(words, "$1.5").endMs).toBeCloseTo(800 + 10 * unit, 6);
    expect(byText(words, "trillion").endMs).toBeCloseTo(800 + 18 * unit, 6);
    expect(byText(words, "to").endMs).toBeCloseTo(800 + 20 * unit, 6);
    expect(byText(words, "$700").endMs).toBeCloseTo(800 + 32 * unit, 6);
    expect(byText(words, "billion").endMs).toBeCloseTo(4000, 6);
  });
});

describe("alignEvents robustness", () => {
  it("keeps tokens with no letters or digits as zero-length words so captions match the narration", () => {
    const words = alignEvents("Rates rose — then fell.", [
      ev("Rates", 0, 400), ev("rose", 400, 800), ev("then", 800, 1100), ev("fell", 1100, 1500),
    ]);
    expect(words.map((w) => w.text)).toEqual(["Rates", "rose", "—", "then", "fell."]);
    expect(words[2]).toEqual({ text: "—", startMs: 800, endMs: 800 });
    expect(() => assertValidWords(words)).not.toThrow();
  });
  it("keeps '&' between words and a leading symbol before the first word", () => {
    const salt = alignEvents("Salt & pepper", [ev("Salt", 100, 500), ev("pepper", 600, 1000)]);
    expect(salt.map((w) => w.text)).toEqual(["Salt", "&", "pepper"]);
    expect(salt[1]).toMatchObject({ startMs: 500, endMs: 500 });
    const lead = alignEvents("& more", [ev("more", 200, 600)]);
    expect(lead[0]).toEqual({ text: "&", startMs: 200, endMs: 200 });
  });
  it("produces the same token texts as the stand-in voice for the same narration", () => {
    const narration = "Salt & pepper — fell 57% in 2008.";
    const standin = synthWords(narration).map((w) => w.text);
    const aligned = alignEvents(narration, [
      ev("Salt", 0, 300), ev("pepper", 300, 700), ev("fell", 700, 1000), ev("57%", 1000, 1500), ev("in 2008", 1500, 2200),
    ]).map((w) => w.text);
    expect(aligned).toEqual(standin);
  });
  it("gives a token that spans two events the span of both", () => {
    const words = alignEvents("A well-known fact", [
      ev("A", 0, 100), ev("well", 100, 400), ev("known", 400, 800), ev("fact", 800, 1200),
    ]);
    expect(byText(words, "well-known")).toMatchObject({ startMs: 100, endMs: 800 });
  });
  it("ignores punctuation-only events", () => {
    const words = alignEvents("Hi there", [ev("Hi", 0, 300), ev("-", 300, 320), ev("there", 320, 700)]);
    expect(words.map((w) => w.text)).toEqual(["Hi", "there"]);
  });
  it("throws when the voice read different text than the narration", () => {
    expect(() => alignEvents("Hello world", [ev("Hello", 0, 300), ev("there", 300, 700)]))
      .toThrow(VoiceAlignmentError);
    expect(() => alignEvents("Hello world", [ev("Hello", 0, 300), ev("there", 300, 700)]))
      .toThrow(/differ from the narration/);
  });
  it("throws when the voice dropped a word", () => {
    expect(() => alignEvents("one two three", [ev("one", 0, 200), ev("three", 200, 500)]))
      .toThrow(/differ from the narration/);
  });
  it("throws when there are no events for non-empty narration", () => {
    expect(() => alignEvents("Hi", [])).toThrow(/no word events/);
  });
  it("returns an empty list for blank or symbol-only narration", () => {
    expect(alignEvents("   ", [])).toEqual([]);
    expect(alignEvents("— —", [])).toEqual([]);
  });
});
