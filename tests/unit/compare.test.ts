import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";
import { COMPARE, barHeights, compareRevealFrames } from "../../src/scenes/compare/layout";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/synthWords";

const side = (label: string, value: number, factId: string) => ({ label, value, factId });
const compare = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "cmp", type: "compare", narration: "Rome versus Han China.", cues,
  props: { title: "Population, millions", left: side("Rome", 50, "f-a"), right: side("Han China", 57.7, "f-b"), decimals: 1, ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const fact = (id: string, value?: number) => ({ id, claim: "c", ...(value === undefined ? {} : { value }), source: { name: "n", url: "https://example.com/" } });
const facts = (a?: number, b?: number) => parseFacts({ facts: [fact("f-a", a), fact("f-b", b)] });

describe("compare schema", () => {
  it("accepts two labelled non-negative values", () => {
    expect(board(compare()).scenes[0]).toMatchObject({ props: { prefix: "", suffix: "" } });
  });
  it("rejects a negative value, a long label and two zero values", () => {
    expect(() => board(compare({ left: side("Rome", -1, "f-a") }))).toThrow(StoryboardError);
    expect(() => board(compare({ left: side("A label that is far too long", 1, "f-a") }))).toThrow(StoryboardError);
    expect(() => board(compare({ left: side("A", 0, "f-a"), right: side("B", 0, "f-b") }))).toThrow(/greater than zero|at least one/);
  });
});

describe("compare fact tracing", () => {
  it("passes when both sides equal their facts", () => {
    expect(() => assertFactsTraceable(board(compare()), facts(50, 57.7))).not.toThrow();
  });
  it("rejects a side that differs from its fact", () => {
    expect(() => assertFactsTraceable(board(compare()), facts(50, 58))).toThrow(/"cmp" shows 57.7 but fact "f-b" says 58/);
  });
  it("rejects a side whose fact has no value or does not exist", () => {
    expect(() => assertFactsTraceable(board(compare()), facts(undefined, 57.7))).toThrow(/no value/);
    expect(() => assertFactsTraceable(board(compare({ right: side("Han", 57.7, "zzz") })), facts(50, 57.7))).toThrow(/unknown fact "zzz"/);
  });
  it("rejects a value that would display rounded", () => {
    expect(() => assertFactsTraceable(board(compare({ decimals: 0 })), facts(50, 57.7))).toThrow(/would display/);
  });
});

describe("compare cues", () => {
  it("allows one callout and rejects two", () => {
    const one = [{ atWord: "rome", do: "callout", text: "Bigger" }];
    expect(() => assertCuesSupported(board(compare({}, one)))).not.toThrow();
    expect(() => assertCuesSupported(board(compare({}, [...one, ...one])))).toThrow(/at most 1 callout/);
  });
  it("rejects an x anchor", () => {
    expect(() => assertCuesSupported(board(compare({}, [{ atWord: "rome", do: "callout", text: "x", x: 3 }])))).toThrow(/does not use cue x/);
  });
});

describe("barHeights", () => {
  it("scales the taller side to the max and the other proportionally", () => {
    const [l, r] = barHeights(50, 100);
    expect(r).toBe(COMPARE.maxBar);
    expect(l).toBeCloseTo(COMPARE.maxBar / 2, 9);
  });
  it("handles equal values and a zero side", () => {
    expect(barHeights(7, 7)).toEqual([COMPARE.maxBar, COMPARE.maxBar]);
    expect(barHeights(0, 5)).toEqual([0, COMPARE.maxBar]);
  });
});

describe("compare reveal timing", () => {
  const words = (sb: { scenes: { id: string; narration: string }[] }) =>
    Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));
  const f = { facts: [fact("f-a", 50), fact("f-b", 57.7)] };
  it("rejects a scene that exits before both values have counted up to their facts", () => {
    const short = { ...compare(), narration: "Han had more." };
    expect(() => buildVideo(board(short), f, words, 30)).toThrow(/"cmp".*too short/);
  });
  it("accepts a normal-length scene", () => {
    const normal = { ...compare(), narration: "The Han dynasty ruled even more people than Rome did at the time." };
    expect(() => buildVideo(board(normal), f, words, 30)).not.toThrow();
  });
  it("reveal covers both bars' growth", () => {
    expect(compareRevealFrames()).toBe(COMPARE.growStart + COMPARE.sideDelay + COMPARE.growFrames);
  });
});
