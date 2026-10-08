import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TARGET, buildAudioGraph, parseLoudnorm, type LoudnormMeasure } from "./graph";

const run = promisify(execFile);
const STDERR_TAIL_LINES = 8;

/** Runs the system ffmpeg; resolves to its stderr (where filters print measurements). */
export async function runFfmpeg(args: string[]): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", ["-hide_banner", ...args], { maxBuffer: 32 * 1024 * 1024 });
    return stderr;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? (error as Error).message;
    throw new Error(`ffmpeg failed: ${stderr.trim().split("\n").slice(-STDERR_TAIL_LINES).join("\n")}`);
  }
}

export type MixInput = {
  clips: { path: string; startMs: number }[];
  musicPath?: string;
  totalMs: number;
  outPath: string;
};

function inputArgs(input: MixInput): string[] {
  const clips = input.clips.flatMap((clip) => ["-i", clip.path]);
  const music = input.musicPath ? ["-stream_loop", "-1", "-i", input.musicPath] : [];
  return [...clips, ...music];
}

/** Two-pass: measure the mix, then apply a linear loudnorm with the measured values. */
export async function mixAudio(input: MixInput): Promise<LoudnormMeasure> {
  const totalSeconds = Number((input.totalMs / 1000).toFixed(3));
  const graphOptions = {
    clipStartsMs: input.clips.map((c) => c.startMs),
    hasMusic: input.musicPath !== undefined,
    totalSeconds,
  };
  const measureStderr = await runFfmpeg([
    "-y", ...inputArgs(input),
    "-filter_complex", buildAudioGraph(graphOptions),
    "-map", "[out]", "-t", String(totalSeconds), "-f", "null", "-",
  ]);
  const measure = parseLoudnorm(measureStderr);
  await runFfmpeg([
    "-y", ...inputArgs(input),
    "-filter_complex", buildAudioGraph({ ...graphOptions, measure }),
    "-map", "[out]", "-t", String(totalSeconds),
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", input.outPath,
  ]);
  return measure;
}

/** Integrated loudness and true peak of an existing file (`inputI`, `inputTp`). */
export async function measureLoudness(file: string): Promise<LoudnormMeasure> {
  const stderr = await runFfmpeg([
    "-i", file,
    "-af", `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`,
    "-f", "null", "-",
  ]);
  return parseLoudnorm(stderr);
}
