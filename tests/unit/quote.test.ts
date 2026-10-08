import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable, assertTextScenes } from "../../src/schema/validate";
import { QUOTE, quoteRevealFrames } from "../../src/scenes/quote/timing";
import { synthWords } from "../../src/voice/synthWords";

const QUOTE_TEXT = "I came, I saw, I conquered.";
const quote = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "q", type: "quote",
  narration: "After the battle Caesar sent a three word report to Rome saying that he came, he saw, and he conquered.",
  cues,
  props: { quote: QUOTE_TEXT, attribution: "Julius Caesar", factId: "f-q", ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (claim: string) =>
  parseFacts({ facts: [{ id: "f-q", claim, source: { name: "Plutarch", url: "https://example.com/" } }] });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("quote schema", () => {
  it("accepts a quote with an attribution and a fact", () => {
    expect(board(quote()).scenes[0]).toMatchObject({ type: "quote" });
  });
  it("rejects an empty or over-long quote and a missing fact", () => {
    expect(() => board(quote({ quote: "" }))).toThrow(StoryboardError);
    expect(() => board(quote({ quote: "x".repeat(141) }))).toThrow(StoryboardError);
    expect(() => board(quote({ factId: undefined }))).toThrow(StoryboardError);
  });
});

describe("quote fact tracing", () => {
  it("passes when the claim contains the quote verbatim", () => {
    const claim = `Caesar's report after Zela: "${QUOTE_TEXT}" (Plutarch, Life of Caesar)`;
    expect(() => assertFactsTraceable(board(quote()), facts(claim))).not.toThrow();
  });
  it("matches across curly vs straight quotes and extra whitespace", () => {
    const claim = "He wrote:  “I came,   I saw, I conquered.”";
    expect(() => assertFactsTraceable(board(quote()), facts(claim))).not.toThrow();
    const curly = quote({ quote: "It’s “fine”." });
    expect(() => assertFactsTraceable(board(curly), facts('He said: It\'s "fine".'))).not.toThrow();
  });
  it("rejects a quote that is not in the claim, and an unknown fact", () => {
    expect(() => assertFactsTraceable(board(quote()), facts("Caesar won a battle."))).toThrow(/"q".*quote.*fact "f-q"/);
    expect(() => assertFactsTraceable(board(quote({ factId: "zzz" })), facts(QUOTE_TEXT))).toThrow(/unknown fact "zzz"/);
  });
});

describe("quote cues and fit", () => {
  it("does not support cues", () => {
    expect(() => assertCuesSupported(board(quote({}, [{ atWord: "came", do: "callout", text: "x" }])))).toThrow(/"q" \(quote\) does not support cues/);
  });
  it("rejects a quote that cannot fit the lane at the minimum font", () => {
    const longWord = quote({ quote: "Supercalifragilisticexpialidocious-Supercalifragilisticexpialidocious" });
    expect(() => assertTextScenes(board(longWord))).toThrow(/"q".*quote does not fit/);
    expect(() => assertTextScenes(board(quote()))).not.toThrow();
  });
});

describe("quote reveal timing", () => {
  it("grows with the number of words", () => {
    expect(quoteRevealFrames(1)).toBe(QUOTE.start + QUOTE.attrLead + QUOTE.settle);
    expect(quoteRevealFrames(11)).toBe(QUOTE.start + 10 * QUOTE.wordGap + QUOTE.attrLead + QUOTE.settle);
  });
  it("buildVideo rejects a quote read faster than it can be revealed", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    const fast = { ...quote({ quote: text }), narration: "Hi." };
    const f = { facts: [{ id: "f-q", claim: text, source: { name: "n", url: "https://example.com/" } }] };
    expect(() => buildVideo(board(fast), f, words, 30)).toThrow(/"q".*too short/);
  });
});

describe("quote trace and limits (Plan 4 review carry-overs)", () => {
  it("does not accept a quote that only matches inside a longer word", () => {
    expect(() => assertFactsTraceable(board(quote({ quote: "eat" })), facts("A great leader."))).toThrow(/does not appear/);
  });
  it("accepts a quote bounded by punctuation or spaces", () => {
    expect(() => assertFactsTraceable(board(quote({ quote: "eat" })), facts("Men eat, then sleep."))).not.toThrow();
  });
  it("normalizes dash and ellipsis variants on both sides", () => {
    expect(() => assertFactsTraceable(board(quote({ quote: "Wait... go - now" })), facts("He said: Wait… go – now"))).not.toThrow();
  });
  it("caps the attribution at 28 characters so it cannot wrap", () => {
    expect(() => board(quote({ attribution: "a".repeat(28) }))).not.toThrow();
    expect(() => board(quote({ attribution: "a".repeat(29) }))).toThrow(StoryboardError);
  });
});
