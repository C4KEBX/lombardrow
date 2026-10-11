import { describe, expect, it } from "vitest";
import assets from "../../fixtures/fast/mortgage.assets.json";
import facts from "../../fixtures/fast/mortgage.facts.json";
import storyboard from "../../fixtures/fast/mortgage.storyboard.json";
import { chunkWords } from "../../src/captions/chunk";
import { shotAt, shotTransform, BLEED_ANCHOR } from "../../src/scenes/archival/BleedArchival";
import { valueIn } from "../../src/scenes/compare/Compare";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { imageSize } from "../../src/pipeline/imageSize";
import { composeScenes } from "../../src/pipeline/resolveScene";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { checkStoryboard, openerIssues } from "../../src/skill/check";
import { endingFrames, estimatedWords, microhookFrames, pacingIssues, visualChangeFrames } from "../../src/skill/pacing";
import { splitVoice, ttsArgs } from "../../src/voice/edge";
import { voiceFor } from "../../src/voice/types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
type Sb = typeof storyboard;
const check = (sb: unknown) => checkStoryboard(sb, facts, { assets: { json: assets, fileExists: () => true } });
const composed = (sb: unknown) => {
  const parsed = parseStoryboard(sb);
  return { parsed, scenes: composeScenes(parsed, Object.fromEntries(parsed.scenes.map((s) => [s.id, estimatedWords(s)])), 30) };
};

describe("the fast format", () => {
  it("passes check on the mortgage prototype", () => {
    const report = check(storyboard);
    expect(report.issues).toEqual([]);
  });

  it("requires a bleed open", () => {
    const sb = clone(storyboard) as Sb;
    sb.meta.open = "cold";
    expect(() => parseStoryboard(sb)).toThrow(/fast format opens full-bleed/);
  });

  it("opens on a bleed archival scene with no year and a claim", () => {
    const sb = clone(storyboard) as Sb & { scenes: { year?: number }[] };
    sb.scenes[0].year = 1600;
    sb.scenes[0].narration = "How did a mortgage get its name? And it isn't the borrower who dies.";
    const issues = openerIssues(parseStoryboard(sb));
    expect(issues.join("\n")).toMatch(/year counter on frame one/);
    expect(issues.join("\n")).toMatch(/opens on a question/);
    const framed = clone(storyboard) as Sb;
    (framed.scenes[0].props as { layout: string; shots?: unknown }).layout = "framed";
    delete (framed.scenes[0].props as { shots?: unknown }).shots;
    expect(openerIssues(parseStoryboard(framed))[0]).toMatch(/framed archival scene/);
  });

  it("fails a picture that holds too long, too few microhooks and an opening that is not brisk", () => {
    const sb = clone(storyboard) as Sb & { scenes: { brisk?: boolean; microhooks?: string[] }[] };
    sb.scenes[0].props.shots = sb.scenes[0].props.shots!.slice(0, 1);
    for (const scene of sb.scenes) delete scene.microhooks;
    delete sb.scenes[1].brisk;
    const text = check(sb).issues.filter((i) => i.stage === "pacing").map((i) => i.message).join("\n");
    expect(text).toMatch(/The picture holds for [\d.]+ s from 0\.0 s/);
    expect(text).toMatch(/No scene lists a microhook/);
    expect(text).toMatch(/Scene "page" starts in the first 5 s; set "brisk": true/);
  });

  it("counts cuts, cues and bleed shots as visual changes, and finds microhooks by their first word", () => {
    const { parsed, scenes } = composed(storyboard);
    const changes = visualChangeFrames(scenes);
    expect(changes).toContain(scenes[1].startFrame);
    expect(changes).toContain(scenes[0].shotFrames[1]);
    expect(changes).toContain(scenes[2].startFrame + scenes[2].cues[0].frame);
    expect([...changes].sort((a, b) => a - b)).toEqual(changes);
    const hooks = microhookFrames(scenes, 30);
    expect(hooks).toHaveLength(parsed.scenes.reduce((n, s) => n + (s.microhooks?.length ?? 0), 0));
    expect(pacingIssues(parsed, scenes, 30)).toEqual([]);
    expect(pacingIssues({ ...parsed, meta: { ...parsed.meta, format: "classic" } }, scenes, 30)).toEqual([]);
  });

  it("rejects a microhook that is not in the narration word for word", () => {
    const sb = clone(storyboard) as Sb & { scenes: { microhooks?: string[] }[] };
    sb.scenes[0].microhooks = ["And it is not the borrower."];
    expect(() => parseStoryboard(sb)).toThrow(StoryboardError);
  });

  it("needs every bleed shot after the first to start on a word, and the first to start the scene", () => {
    const sb = clone(storyboard) as Sb;
    const shots = sb.scenes[0].props.shots as { atWord?: string }[];
    shots[0].atWord = "Every";
    delete shots[1].atWord;
    expect(() => parseStoryboard(sb)).toThrow(/first shot starts the scene[\s\S]*cuts in on a spoken word/);
  });
});

describe("bleed shots", () => {
  it("puts the shot's centre on the anchor and its width across the frame", () => {
    const shot = { x: 0.7, y: 0.55, w: 0.42, occurrence: 1 };
    const size = { width: 1176, height: 2000 };
    const end = shotTransform(shot, size, 1000, 1000);
    expect(end.left + shot.x * size.width * end.scale).toBeCloseTo(BLEED_ANCHOR.x + 20);
    expect(end.top + shot.y * size.height * end.scale).toBeCloseTo(BLEED_ANCHOR.y);
    expect((1080 / (shot.w * size.width)) * 1.12).toBeCloseTo(end.scale);
    expect(shotTransform(shot, size, 0, 100).scale).toBeGreaterThan(shotTransform(shot, size, 8, 100).scale);
  });

  it("shows the last shot that has started", () => {
    expect(shotAt([0, 40, 90], 0)).toBe(0);
    expect(shotAt([0, 40, 90], 40)).toBe(1);
    expect(shotAt([0, 40, 90], 200)).toBe(2);
  });
});

describe("bold captions", () => {
  it("show one to three words at a time", () => {
    const words = "Every mortgage payment pays off something named after death".split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
    const chunks = chunkWords(words, "bold");
    expect(Math.max(...chunks.map((c) => c.words.length))).toBeLessThanOrEqual(3);
    expect(chunks.every((c) => c.words.map((w) => w.text).join(" ").length <= 16 || c.words.length === 1)).toBe(true);
    expect(chunkWords(words).length).toBeLessThan(chunks.length);
  });
});

describe("brisk voice", () => {
  it("speeds a brisk scene up by about 10% and passes the rate to Edge", () => {
    expect(voiceFor({ brisk: true }, "en-GB-RyanNeural")).toBe("en-GB-RyanNeural@+10%");
    expect(voiceFor({}, "en-GB-RyanNeural")).toBe("en-GB-RyanNeural");
    expect(splitVoice("en-GB-RyanNeural@+10%")).toEqual({ name: "en-GB-RyanNeural", rate: "+10%" });
    const args = ttsArgs("en-GB-RyanNeural@+10%", "t", "o.mp3", "o.json");
    expect(args).toContain("--rate");
    expect(args[args.indexOf("--voice") + 1]).toBe("en-GB-RyanNeural");
    expect(ttsArgs("en-GB-RyanNeural", "t", "o.mp3", "o.json")).not.toContain("--rate");
  });

  it("is estimated about 10% quicker", () => {
    const narration = "This law book, printed in 1600, spells it out. In Latin, mortuum vadium.";
    const plain = estimatedWords({ narration });
    const brisk = estimatedWords({ narration, brisk: true });
    expect(plain.at(-1)!.endMs / brisk.at(-1)!.endMs).toBeGreaterThan(1.05);
  });
});

describe("image size", () => {
  it("reads PNG and JPEG headers", () => {
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageSize(png)).toEqual({ width: 640, height: 480 });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0xd0, 0x04, 0x98, 0x03]);
    expect(imageSize(jpeg)).toEqual({ width: 1176, height: 2000 });
    expect(() => imageSize(Buffer.from([1, 2, 3]))).toThrow(/cannot read/);
  });
});

describe("compare values", () => {
  it("stay hidden until the bar is well grown, then show at full strength", () => {
    expect(valueIn(0)).toBe(0);
    expect(valueIn(0.5)).toBe(0);
    expect(valueIn(0.8)).toBeCloseTo(0.5);
    expect(valueIn(1)).toBe(1);
  });
});

describe("the reveal ending", () => {
  const images = Object.fromEntries(assets.assets.map((a) => [a.id, { src: "x", credit: a.credit, width: 2000, height: 3000 }]));
  const words = (sb: { scenes: { id: string; narration: string; brisk?: boolean }[] }) =>
    Object.fromEntries(sb.scenes.map((s) => [s.id, estimatedWords(s)]));
  const withEnding = (ending: unknown) => ({ ...clone(storyboard), meta: { ...clone(storyboard).meta, ending } });

  it("keeps the door plate when no ending is set", () => {
    const built = buildVideo(storyboard, facts, words, 30, 2500, images);
    expect(built.close.ending).toBeUndefined();
  });

  it("runs the last scene through the sign-off and shows the question on its word", () => {
    const plain = buildVideo(storyboard, facts, words, 30, 2500, images);
    const built = buildVideo(withEnding({ prompt: "Which death is in yours?", atWord: "lose" }), facts, words, 30, 2500, images);
    const last = built.scenes[built.scenes.length - 1];
    expect(built.totalFrames).toBe(plain.totalFrames);
    expect(last.startFrame + last.durationFrames).toBe(built.totalFrames);
    expect(built.close.ending?.promptFrame).toBeGreaterThan(last.startFrame);
    expect(built.close.ending?.promptFrame).toBeLessThan(built.close.startFrame);
  });

  it("rejects a prompt that is not a question or a word not spoken", () => {
    expect(() => parseStoryboard(withEnding({ prompt: "Comment below", atWord: "lose" }))).toThrow(/end it with \?/);
    expect(() => buildVideo(withEnding({ prompt: "Which one?", atWord: "zebra" }), facts, words, 30, 2500, images)).toThrow(/not spoken in the last scene/);
  });
});

describe("the bleed open's hook line", () => {
  const withMeta = (extra: Record<string, unknown>) => parseStoryboard({ ...clone(storyboard), meta: { ...clone(storyboard).meta, ...extra } });
  const images = Object.fromEntries(assets.assets.map((a) => [a.id, { src: "x", credit: a.credit, width: 2000, height: 3000 }]));
  const words = (sb: { scenes: { id: string; narration: string; brisk?: boolean }[] }) =>
    Object.fromEntries(sb.scenes.map((s) => [s.id, estimatedWords(s)]));

  it("reaches the composition on a bleed open", () => {
    const built = buildVideo(withMeta({ hookLine: "Signed in 1648. Still paying." }), facts, words, 30, 2500, images);
    expect(built.bleedOpen?.hookLine).toBe("Signed in 1648. Still paying.");
  });

  it("is refused on another open and capped in length", () => {
    expect(openerIssues(withMeta({ open: "cold", format: "classic", hookLine: "Short line." }))).toContainEqual(expect.stringMatching(/meta.hookLine/));
    expect(() => withMeta({ hookLine: "x".repeat(45) })).toThrow();
  });
});

describe("the comment question as a picture change", () => {
  it("counts its pop on its word in the last scene", () => {
    const sb = parseStoryboard(clone(storyboard));
    const scenes = composeScenes(sb, Object.fromEntries(sb.scenes.map((s) => [s.id, estimatedWords(s)])), 30);
    const last = scenes[scenes.length - 1];
    const word = last.words[2].text.replace(/[^\w]/g, "");
    expect(endingFrames(sb, last, 30)).toEqual([]);
    const [frame] = endingFrames({ ...sb, meta: { ...sb.meta, ending: { prompt: "Which one?", atWord: word, occurrence: 1 } } }, last, 30);
    expect(frame).toBeGreaterThan(last.startFrame);
    expect(frame).toBeLessThan(last.startFrame + last.durationFrames);
  });
});
