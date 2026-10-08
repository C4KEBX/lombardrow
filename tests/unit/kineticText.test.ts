import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertTextScenes } from "../../src/schema/validate";
import { KINETIC, kineticFontSize, kineticRevealFrames } from "../../src/scenes/kinetic-text/timing";
import { synthWords } from "../../src/voice/synthWords";

const kinetic = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "k", type: "kinetic-text", narration: "Debt is not the enemy, risk is the real enemy.", cues,
  props: { lines: ["Debt is", "not the", "enemy"], ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const emphasize = (text: string, atWord = "enemy") => ({ atWord, do: "emphasize", text });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));
const noFacts = { facts: [{ id: "f", claim: "c", value: 1, source: { name: "n", url: "https://example.com/" } }] };

describe("kinetic-text schema", () => {
  it("accepts 1 to 4 short lines and defaults the tone", () => {
    expect(board(kinetic()).scenes[0]).toMatchObject({ props: { tone: "highlight" } });
  });
  it("rejects zero lines, five lines and a line over 14 characters", () => {
    expect(() => board(kinetic({ lines: [] }))).toThrow(StoryboardError);
    expect(() => board(kinetic({ lines: ["a", "b", "c", "d", "e"] }))).toThrow(StoryboardError);
    expect(() => board(kinetic({ lines: ["fifteen letters!"] }))).toThrow(StoryboardError);
  });
  it("requires text on an emphasize cue", () => {
    expect(() => board(kinetic({}, [{ atWord: "enemy", do: "emphasize" }]))).toThrow(/requires text/);
  });
});

describe("kinetic-text cue rules", () => {
  it("accepts up to two emphasize cues that name a word on screen", () => {
    expect(() => assertCuesSupported(board(kinetic({}, [emphasize("debt", "debt"), emphasize("enemy")])))).not.toThrow();
  });
  it("rejects an emphasize cue for a word that is not on screen", () => {
    expect(() => assertCuesSupported(board(kinetic({}, [emphasize("banana")])))).toThrow(/"k".*"banana".*not a word/);
  });
  it("rejects an emphasize cue naming several words", () => {
    expect(() => assertCuesSupported(board(kinetic({}, [emphasize("not the")])))).toThrow(/single word/);
  });
  it("rejects a third emphasize cue and any callout cue", () => {
    const three = [emphasize("debt", "debt"), emphasize("not", "not"), emphasize("enemy")];
    expect(() => assertCuesSupported(board(kinetic({}, three)))).toThrow(/at most 2/);
    expect(() => assertCuesSupported(board(kinetic({}, [{ atWord: "enemy", do: "callout", text: "x" }])))).toThrow(/at most 0 callout/);
  });
  it("rejects two emphasize cues that resolve to the same on-screen word", () => {
    const cues = [emphasize("enemy", "debt"), emphasize("enemy")];
    expect(() => assertCuesSupported(board(kinetic({}, cues)))).toThrow(/"k".*same word/);
  });
  it("still rejects emphasize cues on scenes that cannot render them", () => {
    const big = {
      id: "n", type: "big-number", narration: "Num.", props: { value: 1, label: "l", factId: "f" },
      cues: [{ atWord: "num", do: "emphasize", text: "x" }],
    };
    expect(() => assertCuesSupported(board(big))).toThrow(/cannot render "emphasize"/);
  });
});

describe("assertTextScenes", () => {
  it("rejects digits in kinetic lines (numbers must come from facts via big-number)", () => {
    expect(() => assertTextScenes(board(kinetic({ lines: ["Up 40%"] })))).toThrow(/"k".*digit/);
  });
  it("accepts spelled-out numbers", () => {
    expect(() => assertTextScenes(board(kinetic({ lines: ["Forty percent"] })))).not.toThrow();
  });
});

describe("kinetic layout and timing", () => {
  it("fits the widest line to the lane width and never exceeds the max font", () => {
    expect(kineticFontSize(["Hi"])).toBe(190);
    const wide = kineticFontSize(["abcdefghijklmn"]);
    expect(wide).toBeGreaterThanOrEqual(90);
    expect(wide).toBeLessThan(190);
  });
  it("keeps four lines inside the lane height", () => {
    expect(kineticFontSize(["a", "b", "c", "d"]) * 4 * 1.08).toBeLessThanOrEqual(1066);
  });
  it("reveal time grows with the number of lines", () => {
    expect(kineticRevealFrames(1)).toBe(KINETIC.firstDelay + KINETIC.settle);
    expect(kineticRevealFrames(4)).toBe(KINETIC.firstDelay + 3 * KINETIC.lineGap + KINETIC.settle);
  });
  it("buildVideo rejects a scene shorter than its reveal and accepts a normal one", () => {
    const short = { ...kinetic({ lines: ["a", "b", "c", "d"] }), narration: "Go." };
    expect(() => buildVideo(board(short), noFacts, words, 30)).toThrow(/"k".*too short/);
    expect(() => buildVideo(board(kinetic()), noFacts, words, 30)).not.toThrow();
  });
});
