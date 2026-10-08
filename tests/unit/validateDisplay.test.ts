import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import {
  assertCuesSupported,
  assertFactsTraceable,
  assertHeadlinesFit,
} from "../../src/schema/validate";

const board = (scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", voice: "v" },
    audio: { music: null },
    scenes,
  });
const num = (props: Record<string, unknown>, cues: unknown[] = []) => ({
  id: "n", type: "big-number", narration: "Num.", cues,
  props: { label: "l", factId: "f1", ...props },
});
const title = (headline: string, cues: unknown[] = []) => ({
  id: "t", type: "title", narration: "Hi.", cues, props: { headline },
});
const facts = (value: number) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", value, source: { name: "n", url: "https://example.com/" } }] });

describe("assertFactsTraceable: what the viewer sees must equal the fact", () => {
  it("rejects a value that the chosen decimals would round on screen", () => {
    const sb = board([num({ value: 56.8, decimals: 0 })]);
    expect(() => assertFactsTraceable(sb, facts(56.8))).toThrow(StoryboardError);
    expect(() => assertFactsTraceable(sb, facts(56.8))).toThrow(/display.*57.*56\.8/s);
  });
  it("rejects negative half values that would display differently", () => {
    expect(() => assertFactsTraceable(board([num({ value: -0.5, decimals: 0 })]), facts(-0.5))).toThrow(StoryboardError);
    expect(() => assertFactsTraceable(board([num({ value: -1.25, decimals: 1 })]), facts(-1.25))).toThrow(StoryboardError);
  });
  it("accepts a value that is exactly representable at the chosen decimals", () => {
    expect(() => assertFactsTraceable(board([num({ value: 56.8, decimals: 1 })]), facts(56.8))).not.toThrow();
    expect(() => assertFactsTraceable(board([num({ value: 1234567, decimals: 0 })]), facts(1234567))).not.toThrow();
  });
});

describe("assertCuesSupported: no cue may be accepted and then ignored", () => {
  const callout = { atWord: "half", do: "callout", text: "x" };
  it("allows exactly one callout on a big-number", () => {
    expect(() => assertCuesSupported(board([num({ value: 1 }, [callout])]))).not.toThrow();
  });
  it("rejects a second callout on a big-number", () => {
    expect(() => assertCuesSupported(board([num({ value: 1 }, [callout, callout])]))).toThrow(/"n".*at most 1 callout/);
  });
  it("rejects emphasize cues where no scene renders them", () => {
    const emph = { atWord: "half", do: "emphasize", text: "half" };
    expect(() => assertCuesSupported(board([num({ value: 1 }, [emph])]))).toThrow(/emphasize/);
  });
  it("rejects any cue on a title scene", () => {
    expect(() => assertCuesSupported(board([title("Hi", [callout])]))).toThrow(/"t".*title.*cue/);
  });
  it("accepts scenes without cues", () => {
    expect(() => assertCuesSupported(board([title("Hi"), num({ value: 1 })]))).not.toThrow();
  });
});

describe("assertHeadlinesFit", () => {
  it("accepts a normal headline", () => {
    expect(() => assertHeadlinesFit(board([title("The S&P 500 in 2008")]))).not.toThrow();
  });
  it("rejects a headline containing a word too wide for the lane at the minimum size", () => {
    expect(() => assertHeadlinesFit(board([title("Pneumonoultramicroscopicsilicovolcanoconiosis")]))).toThrow(/"t".*headline/);
  });
  it("accepts a long headline of short words by shrinking it", () => {
    const long = Array.from({ length: 12 }, () => "gold").join(" "); // 59 chars, within the schema cap
    expect(() => assertHeadlinesFit(board([title(long)]))).not.toThrow();
  });
});
