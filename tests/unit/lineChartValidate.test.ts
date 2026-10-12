import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";

const points = [{ x: 2000, y: 10.5 }, { x: 2001, y: 20.25 }, { x: 2002, y: 40.75 }];
const chart = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "c1", type: "line-chart", narration: "It rose.", cues,
  props: { title: "T", points, factId: "f1", decimals: 2, ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (dataset: unknown) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", dataset, source: { name: "n", url: "https://example.com/" } }] });
const callout = (x?: number) => ({ atWord: "rose", do: "callout", text: "Up", ...(x === undefined ? {} : { x }) });

describe("line-chart fact tracing", () => {
  it("passes when the dataset equals the points (key order ignored)", () => {
    const ds = points.map((p) => ({ y: p.y, x: p.x }));
    expect(() => assertFactsTraceable(board(chart()), facts(ds))).not.toThrow();
  });
  it("rejects data that differs from the fact dataset", () => {
    const ds = points.map((p, i) => (i === 1 ? { ...p, y: 99 } : p));
    expect(() => assertFactsTraceable(board(chart()), facts(ds))).toThrow(/"c1".*fact "f1"/);
  });
  it("rejects a fact with no dataset", () => {
    const noData = parseFacts({ facts: [{ id: "f1", claim: "c", source: { name: "n", url: "https://example.com/" } }] });
    expect(() => assertFactsTraceable(board(chart()), noData)).toThrow(/no dataset/);
  });
  it("rejects an unknown fact id", () => {
    expect(() => assertFactsTraceable(board(chart({ factId: "zzz" })), facts(points))).toThrow(/unknown fact "zzz"/);
  });
  it("rejects a last value that would display rounded", () => {
    expect(() => assertFactsTraceable(board(chart({ decimals: 0 })), facts(points))).toThrow(/would display/);
  });
});

describe("line-chart callout cues", () => {
  it("accepts up to 3 callouts with in-range x anchors", () => {
    const sb = board(chart({}, [callout(2000), callout(2001), callout(2002)]));
    expect(() => assertCuesSupported(sb)).not.toThrow();
  });
  it("rejects a 4th callout", () => {
    const sb = board(chart({}, [callout(2000), callout(2001), callout(2002), callout(2002)]));
    expect(() => assertCuesSupported(sb)).toThrow(/at most 3 callout/);
  });
  it("rejects a callout without x", () => {
    expect(() => assertCuesSupported(board(chart({}, [callout()])))).toThrow(/need an x anchor/);
  });
  it("rejects an x outside the chart range", () => {
    expect(() => assertCuesSupported(board(chart({}, [callout(1999)])))).toThrow(/outside.*2000-2002/);
    expect(() => assertCuesSupported(board(chart({}, [callout(2003)])))).toThrow(StoryboardError);
  });
  it("rejects an x anchor on a big-number callout", () => {
    const num = {
      id: "n", type: "big-number", narration: "Num.",
      props: { value: 1, label: "l", factId: "f1" },
      cues: [{ atWord: "num", do: "callout", text: "Up", x: 5 }],
    };
    expect(() => assertCuesSupported(board(num))).toThrow(/does not use cue x anchors/);
  });
});
