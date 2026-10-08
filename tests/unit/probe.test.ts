import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meanVolumeDb, probeDurationMs } from "../../src/audio/probe";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "probe-"));
const tone = path.join(tmp, "tone.wav");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=440:d=1.5", tone]);

describe("probeDurationMs", () => {
  it("returns the duration in milliseconds", async () => {
    expect(await probeDurationMs(tone)).toBeCloseTo(1500, -1);
  });
  it("rejects a missing or unreadable file with a readable error", async () => {
    await expect(probeDurationMs(path.join(tmp, "nope.wav"))).rejects.toThrow(/nope\.wav/);
  });
});

describe("meanVolumeDb", () => {
  it("measures a window of the file", async () => {
    const level = await meanVolumeDb(tone, 0.2, 0.5);
    expect(level).toBeGreaterThan(-30);
    expect(level).toBeLessThan(0);
  });
});
