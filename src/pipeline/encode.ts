import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Remotion's bundled ffmpeg cannot run on macOS 12, so frames are rendered as an image
 * sequence and encoded with the system ffmpeg.
 */
export function ffmpegEncodeArgs(framesDir: string, fps: number, outFile: string): string[] {
  if (!Number.isInteger(fps) || fps <= 0) throw new RangeError("fps must be a positive integer");
  return [
    "-y", "-loglevel", "error",
    "-framerate", String(fps),
    "-pattern_type", "glob", "-i", `${framesDir}/element-*.jpeg`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    outFile,
  ];
}

export async function encodeFrames(framesDir: string, fps: number, outFile: string): Promise<void> {
  await run("ffmpeg", ffmpegEncodeArgs(framesDir, fps, outFile));
}
