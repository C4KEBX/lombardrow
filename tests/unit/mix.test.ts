import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateAmbient } from "../../src/audio/music";
import { measureLoudness, mixAudio, runFfmpeg } from "../../src/audio/mix";
import { probeDurationMs } from "../../src/audio/probe";
import { muxVideoAudio } from "../../src/pipeline/finish";
import { makeStandinProvider } from "../../src/voice/standin";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mix-"));
const clipsFor = async () => {
  const provider = makeStandinProvider(path.join(dir, "cache"));
  const a = await provider("Stocks fell sharply in two thousand eight.", "v");
  const b = await provider("Then they climbed for eleven straight years.", "v");
  return [
    { path: a.audioPath, startMs: 0 },
    { path: b.audioPath, startMs: 4000 },
  ];
};
const streams = (file: string) =>
  JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,codec_type,channels,sample_rate", "-of", "json", file]).toString(),
  ).streams;

describe("mixAudio", () => {
  it("normalizes narration-only audio to -14 LUFS, stereo AAC, padded to the total length", async () => {
    const out = path.join(dir, "narr.m4a");
    await mixAudio({ clips: await clipsFor(), totalMs: 9000, outPath: out });
    expect(streams(out)[0]).toMatchObject({ codec_name: "aac", channels: 2, sample_rate: "44100" });
    expect(await probeDurationMs(out)).toBeCloseTo(9000, -2);
    expect(Math.abs((await measureLoudness(out)).inputI - -14)).toBeLessThan(1);
    expect((await measureLoudness(out)).inputTp).toBeLessThanOrEqual(-1.5);
  });
  it("mixes ducked music under the narration and still hits the loudness target", async () => {
    const music = path.join(dir, "bed.wav");
    await generateAmbient(10, music);
    const out = path.join(dir, "mixed.m4a");
    await mixAudio({ clips: await clipsFor(), musicPath: music, totalMs: 9000, outPath: out });
    expect(await probeDurationMs(out)).toBeCloseTo(9000, -2);
    const loudness = await measureLoudness(out);
    expect(Math.abs(loudness.inputI - -14)).toBeLessThan(1);
    expect(loudness.inputTp).toBeLessThanOrEqual(-1.5);
  });
  it("loops music that is shorter than the video", async () => {
    const music = path.join(dir, "short.wav");
    await generateAmbient(6, music);
    const out = path.join(dir, "looped.m4a");
    await mixAudio({ clips: await clipsFor(), musicPath: music, totalMs: 9000, outPath: out });
    expect(await probeDurationMs(out)).toBeCloseTo(9000, -2);
  });
  it("fails clearly when the audio is silent", async () => {
    const silent = path.join(dir, "silent.wav");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "2", silent]);
    await expect(
      mixAudio({ clips: [{ path: silent, startMs: 0 }], totalMs: 2000, outPath: path.join(dir, "x.m4a") }),
    ).rejects.toThrow(/silent/);
  });
});

describe("runFfmpeg", () => {
  it("rejects with the tail of ffmpeg's stderr", async () => {
    await expect(runFfmpeg(["-i", path.join(dir, "does-not-exist.wav"), "-f", "null", "-"])).rejects.toThrow(/does-not-exist/);
  });
});

describe("muxVideoAudio", () => {
  it("copies the video stream and adds the audio track", async () => {
    const video = path.join(dir, "v.mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=320x568:r=30:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
    const audio = path.join(dir, "a.m4a");
    await mixAudio({ clips: [(await clipsFor())[0]], totalMs: 3000, outPath: audio });
    const out = path.join(dir, "final.mp4");
    await muxVideoAudio(video, audio, out);
    const types = streams(out).map((s: { codec_type: string }) => s.codec_type).sort();
    expect(types).toEqual(["audio", "video"]);
    expect(await probeDurationMs(out)).toBeCloseTo(3000, -2);
  });
});
