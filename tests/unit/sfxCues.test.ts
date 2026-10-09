import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { autoCues, cueSheet, manualCues, yearTicks, type CueTimeline } from "../../src/audio/cues";
import { loadMusicLibrary, loadSfxLibrary } from "../../src/audio/library";
import { WIPE } from "../../src/compose/wipe";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/standin";

const FPS = 30;
const timeline: CueTimeline = {
  scenes: [
    { id: "a", startFrame: 60, scene: { type: "title" } },
    { id: "b", startFrame: 300, scene: { type: "archival" } },
    { id: "c", startFrame: 600, scene: { type: "ledger-page" } },
  ],
  open: { frames: 60 },
  close: { startFrame: 900 },
  years: [{ from: 1494, to: 1494, startFrame: 60, endFrame: 300, fadeIn: true, fadeOut: false }, { from: 1494, to: 1626, startFrame: 300, endFrame: 600, fadeIn: false, fadeOut: true }],
  stamps: [{ startFrame: 310 }],
};

describe("autoCues", () => {
  const cues = autoCues(timeline, FPS);
  const at = (sound: string) => cues.filter((c) => c.sound === sound).map((c) => Math.round(c.atMs));

  it("puts the pen under the open's rule and the low hit under the door plate", () => {
    expect(at("pen-underline")).toEqual([0]);
    expect(at("low-hit")).toEqual([30000]);
  });
  it("whooshes on every wipe, centred on the cut, but not into the first scene", () => {
    const lead = (WIPE.frames / 2) * (1000 / FPS);
    expect(at("whoosh-soft")).toEqual([10000 - lead, 20000 - lead, 30000 - lead].map(Math.round));
  });
  it("adds paper for archival and ledger scenes and a thud for each stamp", () => {
    expect(at("paper-slide")).toEqual([10000]);
    expect(at("page-turn")).toEqual([20000]);
    expect(at("stamp")).toEqual([Math.round((310 * 1000) / FPS)]);
  });
  it("is sorted by time", () => {
    expect(cues.map((c) => c.atMs)).toEqual([...cues.map((c) => c.atMs)].sort((a, b) => a - b));
  });
});

describe("yearTicks", () => {
  it("ticks while the counter rolls, never closer than 70 ms, ending on the settled year, and quieter as it slows", () => {
    const ticks = yearTicks(timeline.years[1], FPS);
    expect(ticks.length).toBeGreaterThan(5);
    const times = ticks.map((t) => t.atMs);
    for (let i = 1; i < times.length - 1; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(70 - 1e-9);
    expect(times[0]).toBeGreaterThanOrEqual(10000);
    expect(times[times.length - 1]).toBeLessThanOrEqual(10000 + 1200 + 1e-9);
    expect(ticks[ticks.length - 1].gainDb).toBeLessThan(ticks[0].gainDb);
  });
  it("is silent when the year does not change", () => {
    expect(yearTicks(timeline.years[0], FPS)).toEqual([]);
  });
});

describe("manualCues and cueSheet", () => {
  it("times a hand-placed cue from its scene's start", () => {
    expect(manualCues(timeline, [{ scene: "b", sound: "coin", atMs: 1500, gainDb: -3 }], FPS)).toEqual([{ sound: "coin", atMs: 11500, gainDb: -3 }]);
    expect(() => manualCues(timeline, [{ scene: "zz", sound: "coin", atMs: 0 }], FPS)).toThrow(/scene "zz"/);
  });
  it("drops the automatic cues when auto is off and fails on a sound the library lacks", () => {
    const known = new Set(["coin"]);
    expect(cueSheet(timeline, { auto: false, cues: [{ scene: "a", sound: "coin", atMs: 0 }] }, FPS, known)).toHaveLength(1);
    expect(() => cueSheet(timeline, { auto: true, cues: [] }, FPS, known)).toThrow(/not in sfx\/library.json/);
  });
});

describe("the committed libraries", () => {
  const sfx = loadSfxLibrary(path.resolve("sfx"));
  const music = loadMusicLibrary(path.resolve("music"));

  it("have every file they list, and every sound the automatic cues use", () => {
    for (const s of sfx.sounds) expect(fs.existsSync(path.join(sfx.dir, s.file)), s.file).toBe(true);
    for (const t of music.tracks) expect(fs.existsSync(path.join(music.dir, t.file)), t.file).toBe(true);
    const ids = new Set(sfx.sounds.map((s) => s.id));
    for (const c of autoCues(timeline, FPS)) expect(ids.has(c.sound), c.sound).toBe(true);
  });
  it("give a credit line for every bed whose license asks for one", () => {
    for (const t of music.tracks) if (t.license === "cc-by-4.0") expect(t.credit).toMatch(/CC BY 4\.0/);
  });
  it("cue a real storyboard end to end", () => {
    const sb = JSON.parse(fs.readFileSync("videos/no-001-rule-of-72/storyboard.json", "utf-8"));
    const facts = JSON.parse(fs.readFileSync("videos/no-001-rule-of-72/facts.json", "utf-8"));
    const words = (s: { scenes: { id: string; narration: string }[] }) => Object.fromEntries(s.scenes.map((x) => [x.id, synthWords(x.narration)]));
    const built = buildVideo(sb, facts, words, FPS, undefined, 2000, { "summa-fol-181": { src: "x", credit: "c" } });
    const cues = cueSheet(built, built.storyboard.audio.sfx, FPS, new Set(sfx.sounds.map((s) => s.id)));
    expect(cues.some((c) => c.sound === "paper-slide")).toBe(true);
    expect(cues.some((c) => c.sound === "stamp")).toBe(true);
    expect(cues.every((c) => c.atMs >= 0 && c.atMs < (built.totalFrames * 1000) / FPS)).toBe(true);
  });
});
