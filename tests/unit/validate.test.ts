import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import {
  assertDuration,
  assertFactsTraceable,
  assertVariety,
  MAX_VIDEO_MS,
  MIN_VIDEO_MS,
} from "../../src/schema/validate";

const title = (id: string) => ({ id, type: "title", narration: "Hi.", props: { headline: "Hi" } });
const num = (id: string, value: number, factId = "f1") => ({
  id, type: "big-number", narration: "Num.", props: { value, label: "l", factId },
});
const board = (scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (value?: number) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", value, source: { name: "n", url: "https://example.com/" } }] });

describe("assertVariety", () => {
  it("passes when no 3 consecutive scenes share a type", () => {
    expect(() => assertVariety(board([title("a"), title("b"), num("c", 1), title("d")]))).not.toThrow();
  });
  it("rejects 3 identical consecutive scene types, naming them", () => {
    const sb = board([title("a"), title("b"), title("c")]);
    expect(() => assertVariety(sb)).toThrow(StoryboardError);
    expect(() => assertVariety(sb)).toThrow(/"a".*"b".*"c"/);
  });
  it("handles storyboards with fewer than 3 scenes", () => {
    expect(() => assertVariety(board([title("a")]))).not.toThrow();
  });
});

describe("assertFactsTraceable", () => {
  it("passes when the displayed value equals the sourced fact", () => {
    expect(() => assertFactsTraceable(board([num("n", 57)]), facts(57))).not.toThrow();
  });
  it("rejects a reference to an unknown fact id", () => {
    expect(() => assertFactsTraceable(board([num("n", 57, "nope")]), facts(57))).toThrow(/unknown fact "nope"/);
  });
  it("rejects a displayed value that differs from the fact", () => {
    expect(() => assertFactsTraceable(board([num("n", 57)]), facts(56.8))).toThrow(/57.*56\.8/);
  });
  it("rejects a fact that has no value to verify against", () => {
    expect(() => assertFactsTraceable(board([num("n", 57)]), facts(undefined))).toThrow(/no value/);
  });
  it("ignores scenes that show no number", () => {
    expect(() => assertFactsTraceable(board([title("a")]), facts(1))).not.toThrow();
  });
});

describe("assertDuration", () => {
  it("accepts 55s to 60s inclusive", () => {
    expect(() => assertDuration(MIN_VIDEO_MS)).not.toThrow();
    expect(() => assertDuration(MAX_VIDEO_MS)).not.toThrow();
  });
  it("rejects shorter and longer videos with the actual length", () => {
    expect(() => assertDuration(54_999)).toThrow(/55.*60/);
    expect(() => assertDuration(60_001)).toThrow(/60\.0/);
  });
  it("rejects NaN", () => {
    expect(() => assertDuration(NaN)).toThrow(StoryboardError);
  });
});
