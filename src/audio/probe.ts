import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function probeDurationMs(file: string): Promise<number> {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
    ]);
    const seconds = Number(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("no duration");
    return seconds * 1000;
  } catch (error) {
    throw new Error(`ffprobe could not read a duration from ${file}: ${(error as Error).message}`);
  }
}

/** Mean volume (dB) of a window, via ffmpeg volumedetect. Used by tests and sanity checks. */
export async function meanVolumeDb(file: string, startSec: number, durSec: number): Promise<number> {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-ss", String(startSec), "-t", String(durSec), "-i", file,
    "-af", "volumedetect", "-f", "null", "-",
  ]);
  const match = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr);
  if (!match) throw new Error(`volumedetect gave no mean volume for ${file}`);
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}
