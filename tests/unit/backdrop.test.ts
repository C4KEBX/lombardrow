import { describe, expect, it } from "vitest";
import facts from "../../fixtures/fast/mortgage.facts.json";
import storyboard from "../../fixtures/fast/mortgage.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { composeScenes } from "../../src/pipeline/resolveScene";
import { parseStoryboard, sceneAssetIds, storyboardAssetIds } from "../../src/schema/storyboard";
import { estimatedWords, pacingIssues, visualChangeFrames } from "../../src/skill/pacing";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const ASSET = "littleton-1600-dead-pledge";
const backdrop = { assetId: ASSET, shots: [{ x: 0.5, y: 0.5, w: 0.4 }, { atWord: "Gage", x: 0.3, y: 0.4, w: 0.3 }] };
const words = (sb: { scenes: { id: string; narration: string; brisk?: boolean }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, estimatedWords(s)]));

function withBackdrop(extra: Record<string, unknown> = {}) {
  const sb = clone(storyboard) as unknown as { meta: { doorNo: number }; scenes: Record<string, unknown>[] };
  const scene = sb.scenes.find((s) => s.id === "word");
  if (!scene) throw new Error("fixture has no word scene");
  Object.assign(scene, { backdrop: clone(backdrop) }, extra);
  return sb;
}

describe("backdrops behind graphic scenes", () => {
  it("cut on spoken words, count as picture changes and put the scene on ink", () => {
    const parsed = parseStoryboard(withBackdrop());
    const scenes = composeScenes(parsed, words(parsed), 30);
    const word = scenes.find((s) => s.id === "word");
    expect(word?.ground).toBe("ink");
    expect(word?.shotFrames[0]).toBe(0);
    expect(word?.shotFrames[1]).toBeGreaterThan(0);
    expect(visualChangeFrames(scenes)).toContain((word?.startFrame ?? 0) + (word?.shotFrames[1] ?? 0));
    expect(sceneAssetIds(parsed.scenes.find((s) => s.id === "word")!)).toEqual([ASSET]);
  });

  it("follow the shot rules and are refused on archival scenes and other grounds", () => {
    const noWord = withBackdrop();
    delete ((noWord.scenes.find((s) => s.id === "word")!.backdrop as typeof backdrop).shots[1] as { atWord?: string }).atWord;
    expect(() => parseStoryboard(noWord)).toThrow(/cuts in on a spoken word/);
    expect(() => parseStoryboard(withBackdrop({ ground: "parchment" }))).toThrow(/draws on ink/);
    const archival = clone(storyboard) as unknown as { scenes: Record<string, unknown>[] };
    archival.scenes[0].backdrop = clone(backdrop);
    expect(() => parseStoryboard(archival)).toThrow(/already an image/);
  });

  it("are required on every graphic scene from No. 005", () => {
    const sb = withBackdrop();
    const early = parseStoryboard(sb);
    expect(pacingIssues(early, composeScenes(early, words(early), 30), 30).join("\n")).not.toMatch(/plain ground/);
    sb.meta.doorNo = 5;
    const late = parseStoryboard(sb);
    const text = pacingIssues(late, composeScenes(late, words(late), 30), 30).join("\n");
    expect(text).toMatch(/Scene "deal" puts its flow-diagram on a plain ground/);
    expect(text).not.toMatch(/Scene "word" puts/);
    expect(text).not.toMatch(/Scene "hook" puts/);
  });

  it("need their image's pixel size to build", () => {
    const sb = withBackdrop();
    const images = { [ASSET]: { src: "x", credit: "c" } };
    expect(() => buildVideo(sb, facts, words, 30, 1000, images)).toThrow(/pixel size/);
  });
});

describe("the image cover", () => {
  const withCover = (cover: Record<string, unknown>) => {
    const sb = clone(storyboard) as unknown as { meta: Record<string, unknown> };
    sb.meta.cover = cover;
    return sb;
  };

  it("names its image among the video's images and marks one word of its line", () => {
    const sb = parseStoryboard(withCover({ line: "Dead pledge, live debt.", mark: "pledge", assetId: "cover-image", x: 0.5, y: 0.5, w: 0.4 }));
    expect(storyboardAssetIds(sb)).toContain("cover-image");
    expect(() => parseStoryboard(withCover({ line: "Dead pledge, live debt.", mark: "loan", assetId: ASSET, x: 0.5, y: 0.5, w: 0.4 }))).toThrow(/one word of cover.line/);
  });
});
