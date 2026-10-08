import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { describe, expect, it } from "vitest";
import { encodeFrames } from "../../src/pipeline/encode";
import { browserExecutable, getServeUrl } from "../../src/testing/renderHelpers";

describe("HelloBigNumber golden render", () => {
  it("produces a 1080x1920 30fps h264 video of the expected length", async () => {
    const tmp = path.resolve("tests/render/_tmp");
    const framesDir = path.join(tmp, "hello-frames");
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const video = path.join(tmp, "hello.mp4");

    const serveUrl = await getServeUrl();
    const composition = await selectComposition({ serveUrl, browserExecutable: browserExecutable(), id: "HelloBigNumber" });
    await renderFrames({
      composition, serveUrl, browserExecutable: browserExecutable(), outputDir: framesDir, imageFormat: "jpeg",
      inputProps: {}, onStart: () => undefined, onFrameUpdate: () => undefined,
    });
    await encodeFrames(framesDir, composition.fps, video);

    const probe = JSON.parse(
      execFileSync("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate,duration",
        "-of", "json", video,
      ]).toString(),
    ).streams[0];

    expect(probe.codec_name).toBe("h264");
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.r_frame_rate).toBe("30/1");
    expect(Number(probe.duration)).toBeCloseTo(composition.durationInFrames / composition.fps, 1);
    expect(composition.durationInFrames).toBe(159); // 78 + 81 frames from the fixtures
  });
});
