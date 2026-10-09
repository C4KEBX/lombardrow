import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { measureLoudness } from "../../src/audio/mix";
import { probeDurationMs } from "../../src/audio/probe";
import { produce } from "../../src/pipeline/produce";

describe("produce (stand-in voice, generated music)", () => {
  it("makes a narrated, captioned, mixed 1080x1920 video from the hello storyboard", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "produce-"));
    const storyboard = JSON.parse(fs.readFileSync("fixtures/hello.storyboard.json", "utf-8"));
    storyboard.audio.music = "ambient";
    const sbPath = path.join(outDir, "storyboard.json");
    fs.writeFileSync(sbPath, JSON.stringify(storyboard));

    const result = await produce({
      storyboardPath: sbPath,
      factsPath: "fixtures/hello.facts.json",
      outDir: path.join(outDir, "run"),
      voice: "standin",
      enforceLength: false,
      cacheDir: path.join(outDir, "voice"),
      musicDir: path.join(outDir, "music"),
    });

    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,channels", "-of", "json", result.videoPath]).toString(),
    ).streams;
    const video = probe.find((s: { codec_type: string }) => s.codec_type === "video");
    const audio = probe.find((s: { codec_type: string }) => s.codec_type === "audio");
    expect(video).toMatchObject({ codec_name: "h264", width: 1080, height: 1920, r_frame_rate: "30/1" });
    expect(audio).toMatchObject({ codec_name: "aac", channels: 2 });
    expect(await probeDurationMs(result.videoPath)).toBeCloseTo((result.totalFrames / 30) * 1000, -2);
    const loud = await measureLoudness(result.videoPath);
    expect(Math.abs(loud.inputI - -14)).toBeLessThan(1);
    expect(loud.inputTp).toBeLessThanOrEqual(-1.5);
    expect(JSON.parse(fs.readFileSync(result.manifestPath, "utf-8")).scenes).toHaveLength(2);
  }, 240000);

  it("enforces the 55-70 second length by default", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "produce-short-"));
    await expect(
      produce({
        storyboardPath: "fixtures/hello.storyboard.json",
        factsPath: "fixtures/hello.facts.json",
        outDir,
        voice: "standin",
        enforceLength: true,
        cacheDir: path.join(outDir, "voice"),
      }),
    ).rejects.toThrow(/required 55-70s/);
  }, 120000);

  it("rejects an unsafe music name before rendering", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "produce-music-"));
    const storyboard = JSON.parse(fs.readFileSync("fixtures/hello.storyboard.json", "utf-8"));
    storyboard.audio.music = "../secret.mp3";
    const sbPath = path.join(outDir, "storyboard.json");
    fs.writeFileSync(sbPath, JSON.stringify(storyboard));
    const started = Date.now();
    await expect(
      produce({
        storyboardPath: sbPath, factsPath: "fixtures/hello.facts.json", outDir: path.join(outDir, "run"),
        voice: "standin", enforceLength: false, cacheDir: path.join(outDir, "voice"), musicDir: path.join(outDir, "music"),
      }),
    ).rejects.toThrow(/unsafe/);
    expect(Date.now() - started).toBeLessThan(20000); // failed fast, before any rendering
  }, 120000);
});
