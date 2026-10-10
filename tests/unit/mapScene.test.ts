import { describe, expect, it } from "vitest";
import { assertSceneTiming } from "../../src/pipeline/assertSceneTiming";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable, assertMapRegions } from "../../src/schema/validate";
import { MAP, regionCueFrames } from "../../src/scenes/map/timing";
import { synthWords } from "../../src/voice/synthWords";

const REGIONS = ["Italy", "Spain", "France", "Greece", "Turkey", "Egypt"];
const NARRATION = "At its height Rome reached from Italy to Spain, France, Greece, Turkey and Egypt, a very large stretch of the world.";
const cue = (name: string) => ({ atWord: name, do: "emphasize", text: name });
const CUES = REGIONS.map(cue);
const map = (props: Record<string, unknown> = {}, cues: unknown[] = CUES) => ({
  id: "m", type: "map", narration: NARRATION, cues,
  props: { title: "The Roman world", regions: REGIONS, focus: [-12, 28, 45, 56], factId: "f-m", ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (dataset?: unknown) =>
  parseFacts({
    facts: [{ id: "f-m", claim: "c", ...(dataset === undefined ? {} : { dataset }), source: { name: "n", url: "https://example.com/" } }],
  });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("map schema", () => {
  it("accepts regions and a focus box and defaults the tone", () => {
    expect(board(map()).scenes[0]).toMatchObject({ props: { tone: "highlight" } });
  });
  it("rejects zero or seven regions, duplicates and a long name", () => {
    expect(() => board(map({ regions: [] }))).toThrow(StoryboardError);
    expect(() => board(map({ regions: ["A", "B", "C", "D", "E", "F", "G"] }))).toThrow(StoryboardError);
    expect(() => board(map({ regions: ["Italy", "Italy"] }))).toThrow(/duplicate/);
    expect(() => board(map({ regions: ["x".repeat(41)] }))).toThrow(StoryboardError);
  });
  it("rejects an inverted or out-of-range focus box", () => {
    expect(() => board(map({ focus: [45, 28, -12, 56] }))).toThrow(StoryboardError);
    expect(() => board(map({ focus: [-12, 56, 45, 28] }))).toThrow(StoryboardError);
    expect(() => board(map({ focus: [-200, 28, 45, 56] }))).toThrow(StoryboardError);
    expect(() => board(map({ focus: [-12, 28, 45, 90] }))).toThrow(StoryboardError);
  });
});

describe("assertMapRegions", () => {
  it("accepts real atlas names", () => {
    expect(() => assertMapRegions(board(map()))).not.toThrow();
  });
  it("rejects a region that lies outside the focus box (it would light off-screen)", () => {
    const sb = board(map({ regions: ["Italy", "Japan"] }, [cue("Italy"), cue("Japan")]));
    expect(() => assertMapRegions(sb)).toThrow(/"m".*"Japan".*outside the focus/);
  });
  it("rejects an unknown name and suggests the atlas spelling", () => {
    const sb = board(map({ regions: ["United States"] }, [cue("United")]));
    expect(() => assertMapRegions(sb)).toThrow(/"m".*"United States".*United States of America/);
  });
});

describe("map fact tracing", () => {
  it("passes when the dataset equals the region list", () => {
    expect(() => assertFactsTraceable(board(map()), facts(REGIONS))).not.toThrow();
  });
  it("rejects a different list, a different order, and a fact without a dataset", () => {
    expect(() => assertFactsTraceable(board(map()), facts(["Italy", "Spain"]))).toThrow(/"m".*dataset of fact "f-m"/);
    expect(() => assertFactsTraceable(board(map()), facts([...REGIONS].reverse()))).toThrow(/dataset/);
    expect(() => assertFactsTraceable(board(map()), facts())).toThrow(/no dataset/);
  });
});

describe("map cue rules", () => {
  it("accepts one emphasize cue per region in any order", () => {
    expect(() => assertCuesSupported(board(map({}, [...CUES].reverse())))).not.toThrow();
  });
  it("rejects a missing cue, a callout cue and a cue word that is not a region word", () => {
    expect(() => assertCuesSupported(board(map({}, CUES.slice(1))))).toThrow(/exactly one emphasize cue per region/);
    expect(() => assertCuesSupported(board(map({}, [...CUES, { atWord: "Egypt", do: "callout", text: "x" }])))).toThrow(/at most 0 callout/);
    expect(() => assertCuesSupported(board(map({}, [{ atWord: "Italy", do: "emphasize", text: "Rome" }, ...CUES.slice(1)])))).toThrow(/not a word on screen/);
  });
  it("rejects two cues that land on one region when regions share a word (loud, not silent)", () => {
    const regions = ["United Kingdom", "United States of America"];
    const cues = [{ atWord: "Britain", do: "emphasize", text: "United" }, { atWord: "America", do: "emphasize", text: "United" }];
    expect(() => assertCuesSupported(board(map({ regions }, cues)))).toThrow(/same region/);
  });
});

describe("regionCueFrames", () => {
  it("returns each region's cue frame in region order regardless of spoken order", () => {
    const cues = [
      { frame: 90, do: "emphasize", text: "Spain" },
      { frame: 40, do: "emphasize", text: "Italy" },
    ];
    expect(regionCueFrames(["Italy", "Spain"], cues)).toEqual([40, 90]);
  });
});

describe("map in buildVideo", () => {
  it("accepts a normal scene and rejects one that exits before the last region lights up", () => {
    expect(() => buildVideo(board(map()), facts(REGIONS), words, 30)).not.toThrow();
    // The 12-frame tail pad means narration alone cannot trigger this, so drive the check with a hand-built short scene.
    const scene = board(map()).scenes[0];
    const composed = (durationFrames: number, lastCue: number) => ({
      id: "m", scene, ground: "ink" as const, durationFrames, startFrame: 0, words: [], shotFrames: [],
      cues: REGIONS.map((name, i) => ({ frame: i === REGIONS.length - 1 ? lastCue : i, do: "emphasize" as const, text: name })),
    });
    expect(() => assertSceneTiming([composed(30, 25)])).toThrow(/"m".*too short/);
    expect(() => assertSceneTiming([composed(120, 25)])).not.toThrow();
  });
  it("rejects an unknown country name at build time", () => {
    const bad = map({ regions: ["Atlantis"] }, [cue("Atlantis")]);
    expect(() => buildVideo(board(bad), facts(["Atlantis"]), words, 30)).toThrow(/Atlantis/);
  });
  it("MAP.zoomFrames is positive", () => {
    expect(MAP.zoomFrames).toBeGreaterThan(0);
  });
});
