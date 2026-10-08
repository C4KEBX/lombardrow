import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meanVolumeDb, probeDurationMs } from "../../src/audio/probe";
import { ambientArgs, generateAmbient, isSafeMusicName, resolveMusic } from "../../src/audio/music";

describe("isSafeMusicName", () => {
  it("accepts plain file names and rejects traversal and odd characters", () => {
    expect(isSafeMusicName("calm.mp3")).toBe(true);
    expect(isSafeMusicName("track_01-v2.wav")).toBe(true);
    for (const bad of ["../x.mp3", "a/b.mp3", "/etc/passwd", ".hidden", "a b.mp3", "", "x;rm.mp3", "..", "a\\b.mp3"]) {
      expect(isSafeMusicName(bad)).toBe(false);
    }
  });
});

describe("ambientArgs", () => {
  it("builds a four-sine drone with a fade in and out sized to the duration", () => {
    const args = ambientArgs(12, "/t/out.wav").join(" ");
    expect(args.match(/sine=f=/g)).toHaveLength(4);
    expect(args).toContain("afade=t=out:st=9.000:d=3");
    expect(args.endsWith("/t/out.wav")).toBe(true);
  });
  it("rejects a duration too short to fade", () => {
    expect(() => ambientArgs(2, "/t/o.wav")).toThrow(RangeError);
  });
});

describe("generateAmbient and resolveMusic", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "music-"));
  it("renders an audible bed of the requested length", async () => {
    const out = path.join(dir, "bed.wav");
    await generateAmbient(8, out);
    expect(await probeDurationMs(out)).toBeCloseTo(8000, -2);
    expect(await meanVolumeDb(out, 2, 3)).toBeGreaterThan(-50);
  });
  it("returns undefined for null, generates for 'ambient'", async () => {
    expect(await resolveMusic(null, 8, dir, dir)).toBeUndefined();
    const generated = await resolveMusic("ambient", 8, dir, dir);
    expect(generated && fs.existsSync(generated)).toBe(true);
  });
  it("resolves a named file inside the music dir and rejects unsafe or missing names", async () => {
    fs.writeFileSync(path.join(dir, "mine.wav"), "x");
    expect(await resolveMusic("mine.wav", 8, dir, dir)).toBe(path.join(dir, "mine.wav"));
    await expect(resolveMusic("../mine.wav", 8, dir, dir)).rejects.toThrow(/unsafe/);
    await expect(resolveMusic("missing.wav", 8, dir, dir)).rejects.toThrow(/not found/);
  });
});
