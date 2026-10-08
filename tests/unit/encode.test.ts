import { describe, expect, it } from "vitest";
import { ffmpegEncodeArgs } from "../../src/pipeline/encode";

describe("ffmpegEncodeArgs", () => {
  it("builds a libx264 yuv420p encode from a JPEG frame sequence", () => {
    const args = ffmpegEncodeArgs("out/frames", 30, "out/video.mp4");
    expect(args).toEqual([
      "-y", "-loglevel", "error",
      "-framerate", "30",
      "-pattern_type", "glob", "-i", "out/frames/element-*.jpeg",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "out/video.mp4",
    ]);
  });
  it("rejects a non-positive or non-integer fps", () => {
    expect(() => ffmpegEncodeArgs("f", 0, "o.mp4")).toThrow(RangeError);
    expect(() => ffmpegEncodeArgs("f", 29.97, "o.mp4")).toThrow(RangeError);
  });
});
