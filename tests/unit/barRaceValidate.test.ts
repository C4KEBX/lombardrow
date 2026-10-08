import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";

const frames = [
  { label: "2020", values: [{ name: "A", value: 1 }, { name: "B", value: 2 }] },
  { label: "2021", values: [{ name: "A", value: 3 }, { name: "B", value: 2 }] },
];
const race = (cues: unknown[] = []) => ({
  id: "r1", type: "bar-race", narration: "Race.", cues,
  props: { title: "T", frames, factId: "f1" },
});
const board = (s: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", voice: "v" },
    audio: { music: null },
    scenes: [s],
  });
const facts = (dataset?: unknown) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", dataset, source: { name: "n", url: "https://example.com/" } }] });

describe("bar-race fact tracing", () => {
  it("passes when the dataset equals the frames", () => {
    expect(() => assertFactsTraceable(board(race()), facts(frames))).not.toThrow();
  });
  it("rejects different data and missing datasets", () => {
    const changed = [frames[0], { ...frames[1], values: [{ name: "A", value: 4 }, { name: "B", value: 2 }] }];
    expect(() => assertFactsTraceable(board(race()), facts(changed))).toThrow(/"r1".*fact "f1"/);
    expect(() => assertFactsTraceable(board(race()), facts(undefined))).toThrow(/no dataset/);
  });
});

describe("bar-race callouts", () => {
  const callout = { atWord: "race", do: "callout", text: "New leader" };
  it("allows one callout without an x anchor", () => {
    expect(() => assertCuesSupported(board(race([callout])))).not.toThrow();
  });
  it("rejects two callouts and any x anchor", () => {
    expect(() => assertCuesSupported(board(race([callout, callout])))).toThrow(/at most 1 callout/);
    expect(() => assertCuesSupported(board(race([{ ...callout, x: 1 }])))).toThrow(/does not use cue x anchors/);
  });
});
