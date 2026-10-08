import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const MIN_AMBIENT_SECONDS = 6;
const FADE_SECONDS = 3;
// A minor drone: A2, E3, A3, C4
const FREQUENCIES = [110, 164.81, 220, 261.63] as const;

/** Original, procedurally generated drone bed (no third-party material, so no license to track). */
export function ambientArgs(durationSec: number, outPath: string): string[] {
  if (durationSec < MIN_AMBIENT_SECONDS) throw new RangeError(`ambient music needs at least ${MIN_AMBIENT_SECONDS}s`);
  const d = durationSec.toFixed(3);
  const inputs = FREQUENCIES.flatMap((f) => ["-f", "lavfi", "-i", `sine=f=${f}:d=${d}`]);
  const fadeOutStart = (durationSec - FADE_SECONDS).toFixed(3);
  const graph =
    `[0][1][2][3]amix=inputs=4:normalize=0,tremolo=f=0.2:d=0.4,lowpass=f=900,aecho=0.8:0.7:600:0.4,` +
    `afade=t=in:d=2,afade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS},volume=1.2,` +
    `aformat=sample_rates=44100:channel_layouts=stereo`;
  // -t clamps the length: the echo filter would otherwise extend the bed with a tail.
  return ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-t", d, outPath];
}

export async function generateAmbient(durationSec: number, outPath: string): Promise<void> {
  await run("ffmpeg", ambientArgs(durationSec, outPath));
}

export const isSafeMusicName = (name: string): boolean =>
  /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name) && !name.includes("..");

/** `null` -> no music; `"ambient"` -> generated bed; otherwise a file name inside `musicDir`. */
export async function resolveMusic(
  name: string | null,
  durationSec: number,
  musicDir: string,
  workDir: string,
): Promise<string | undefined> {
  if (name === null) return undefined;
  if (name === "ambient") {
    fs.mkdirSync(workDir, { recursive: true });
    const out = path.join(workDir, "ambient.wav");
    await generateAmbient(durationSec, out);
    return out;
  }
  if (!isSafeMusicName(name)) {
    throw new Error(`Music name "${name}" is unsafe; use a plain file name from the music/ folder`);
  }
  const file = path.join(musicDir, name);
  if (!fs.existsSync(file)) throw new Error(`Music file "${name}" not found in ${musicDir}`);
  return file;
}
