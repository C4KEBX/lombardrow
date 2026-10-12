import { runFfmpeg } from "./mix";
import { parseLoudnorm } from "./graph";

/** Library beds are cut to this length: longer than any video, short enough to keep the repo small. */
export const BED_SECONDS = 90;
/** Sound effects are peak-normalized to this level; cue gains are relative to it. */
export const SFX_PEAK_DB = -3;
/** Longest sound effect kept; the subtle ones are well under a second. */
export const SFX_MAX_SECONDS = 4;

const OUT = ["-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k"];

/** Pass 1 of a bed: measure the cut segment. */
export const bedMeasureArgs = (src: string, startSec: number, lufs: number): string[] => [
  "-ss", String(startSec), "-t", String(BED_SECONDS), "-i", src,
  "-af", `loudnorm=I=${lufs}:TP=-1.5:LRA=20:print_format=json`, "-f", "null", "-",
];

/** Pass 2: the same cut, normalized linearly (no pumping) to the library loudness, with a short fade at each end. */
export function bedWriteArgs(
  src: string, startSec: number, lufs: number, m: ReturnType<typeof parseLoudnorm>, out: string,
): string[] {
  const norm =
    `loudnorm=I=${lufs}:TP=-1.5:LRA=20:measured_I=${m.inputI}:measured_TP=${m.inputTp}:measured_LRA=${m.inputLra}` +
    `:measured_thresh=${m.inputThresh}:offset=${m.targetOffset}:linear=true`;
  return [
    "-y", "-ss", String(startSec), "-t", String(BED_SECONDS), "-i", src,
    "-af", `${norm},afade=t=in:d=0.05,afade=t=out:st=${BED_SECONDS - 0.5}:d=0.5`,
    ...OUT, out,
  ];
}

/** Trim leading silence, cap the length, peak-normalize. `peakDb` is the source's current peak. */
export const sfxWriteArgs = (src: string, peakDb: number, out: string): string[] => [
  "-y", "-i", src,
  "-af",
  `silenceremove=start_periods=1:start_threshold=-50dB,atrim=0:${SFX_MAX_SECONDS},` +
    `volume=${(SFX_PEAK_DB - peakDb).toFixed(2)}dB,afade=t=out:st=${SFX_MAX_SECONDS - 0.1}:d=0.1`,
  ...OUT, out,
];

export async function prepareBed(src: string, startSec: number, lufs: number, out: string): Promise<void> {
  const measure = parseLoudnorm(await runFfmpeg(bedMeasureArgs(src, startSec, lufs)));
  await runFfmpeg(bedWriteArgs(src, startSec, lufs, measure, out));
}

export async function peakDb(src: string): Promise<number> {
  const stderr = await runFfmpeg(["-i", src, "-af", "volumedetect", "-f", "null", "-"]);
  const match = /max_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  if (!match) throw new Error(`volumedetect gave no peak for ${src}`);
  return Number(match[1]);
}

export async function prepareSfx(src: string, out: string): Promise<void> {
  await runFfmpeg(sfxWriteArgs(src, await peakDb(src), out));
}
