import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { probeDurationMs } from "../audio/probe";
import type { WordTiming } from "../schema/timing";
import { synthWords } from "./synthWords";
import type { VoiceProvider } from "./types";

export { synthWords } from "./synthWords";

const run = promisify(execFile);
const TAIL_MS = 200;
const sec = (ms: number): string => (ms / 1000).toFixed(3);

/** ffmpeg `volume` expression that is 1 while any word is spoken and 0 otherwise. */
export const standinGate = (words: readonly WordTiming[]): string =>
  `min(1,${words.map((w) => `between(t,${sec(w.startMs)},${sec(w.endMs)})`).join("+")})`;

export function standinArgs(words: readonly WordTiming[], outPath: string): string[] {
  const duration = sec(words[words.length - 1].endMs + TAIL_MS);
  return [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `anoisesrc=color=pink:duration=${duration}:sample_rate=44100:amplitude=0.5`,
    // aeval gates per sample; the volume filter only re-evaluates once per ~23 ms audio frame.
    "-af", `aeval='val(0)*${standinGate(words)}':c=same`,
    outPath,
  ];
}

/** Offline stand-in voice: synthetic word timings and pink noise gated to them. Deterministic, free. */
export function makeStandinProvider(cacheDir: string): VoiceProvider {
  return async (narration, voice) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const key = createHash("sha256").update(`standin\n${voice}\n${narration}`).digest("hex").slice(0, 16);
    const wav = path.join(cacheDir, `standin-${key}.wav`);
    const words = synthWords(narration);
    if (words.length === 0) throw new Error("Stand-in voice needs narration with at least one word");
    if (!fs.existsSync(wav)) await run("ffmpeg", standinArgs(words, wav));
    return { audioPath: wav, words, audioMs: await probeDurationMs(wav) };
  };
}
