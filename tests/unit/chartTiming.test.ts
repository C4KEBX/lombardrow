import { describe, expect, it } from "vitest";
import { synthWords } from "../../src/voice/standin";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { StoryboardError } from "../../src/schema/storyboard";

const facts = (dataset: unknown) => ({
  facts: [{ id: "f1", claim: "c", dataset, source: { name: "n", url: "https://example.com/" } }],
});
const board = (scene: unknown) => ({
  schemaVersion: 1,
  meta: { title: "t", theme: "bold-flat", voice: "v" },
  audio: { music: null },
  scenes: [scene],
});
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

const points = [{ x: 1, y: 1 }, { x: 2, y: 5 }];
const frames = [
  { label: "a", values: [{ name: "X", value: 1 }, { name: "Y", value: 2 }] },
  { label: "b", values: [{ name: "X", value: 3 }, { name: "Y", value: 2 }] },
];

describe("chart scenes must be long enough to finish animating and show their callouts", () => {
  it("rejects a line-chart scene that ends before the line finishes drawing", () => {
    const scene = {
      id: "c", type: "line-chart", narration: "Prices rose.",
      props: { title: "T", points, factId: "f1" },
      cues: [{ atWord: "rose", do: "callout", text: "Up", x: 2 }],
    };
    expect(() => buildVideo(board(scene), facts(points), words, 30)).toThrow(StoryboardError);
    expect(() => buildVideo(board(scene), facts(points), words, 30)).toThrow(/"c".*too short/);
  });
  it("rejects a bar-race scene that ends before the race finishes", () => {
    const scene = {
      id: "r", type: "bar-race", narration: "Race.",
      props: { title: "T", frames, factId: "f1" },
    };
    expect(() => buildVideo(board(scene), facts(frames), words, 30)).toThrow(/"r".*too short/);
  });
  it("accepts a scene long enough for the animation and its callouts", () => {
    const scene = {
      id: "c", type: "line-chart",
      narration: "Prices rose steadily and then kept on rising for the entire year.",
      props: { title: "T", points, factId: "f1" },
      cues: [{ atWord: "rose", do: "callout", text: "Up", x: 2 }],
    };
    expect(() => buildVideo(board(scene), facts(points), words, 30)).not.toThrow();
  });
});

describe("line-chart callout pacing is validated against the narration", () => {
  const longPoints = [{ x: 1, y: 1 }, { x: 2, y: 5 }, { x: 3, y: 2 }];
  const scene = (cues: unknown[]) => ({
    id: "c", type: "line-chart",
    narration: "Prices rose steadily and then fell sharply before settling down for the rest of the long year.",
    props: { title: "T", points: longPoints, factId: "f1" },
    cues,
  });
  it("rejects callouts spoken right to left", () => {
    const cues = [
      { atWord: "rose", do: "callout", text: "Up", x: 3 },
      { atWord: "fell", do: "callout", text: "Down", x: 2 },
    ];
    expect(() => buildVideo(board(scene(cues)), facts(longPoints), words, 30)).toThrow(/"c".*left to right/);
  });
  it("accepts callouts spoken left to right", () => {
    const cues = [
      { atWord: "rose", do: "callout", text: "Up", x: 2 },
      { atWord: "fell", do: "callout", text: "Down", x: 3 },
    ];
    expect(() => buildVideo(board(scene(cues)), facts(longPoints), words, 30)).not.toThrow();
  });
});
