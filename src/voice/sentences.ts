import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { probeDurationMs } from "../audio/probe";
import type { WordTiming } from "../schema/timing";
import type { VoiceProvider, VoiceResult } from "./types";

const run = promisify(execFile);

/**
 * Silence between one sentence's last word and the next one's first. Edge TTS holds about a second
 * at every full stop, which reads as dead air; voicing sentence by sentence and joining them closes it.
 */
export const SENTENCE_GAP_MS = 300;

/** Tokens that end in a full stop without ending a sentence. */
const ABBREVIATIONS = new Set(["e.g.", "i.e.", "vs.", "no.", "st.", "mr.", "mrs.", "dr.", "c.", "ca."]);

/** Splits narration into sentences on whitespace, so the words of the parts are exactly the narration's words. */
export function splitSentences(narration: string): string[] {
  const sentences: string[] = [];
  let current: string[] = [];
  for (const token of narration.split(/\s+/).filter(Boolean)) {
    current.push(token);
    const ends = /[.?!]["'”’)\]]*$/.test(token) && !ABBREVIATIONS.has(token.toLowerCase());
    if (ends) {
      sentences.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) sentences.push(current.join(" "));
  return sentences;
}

/** Where each part starts so that exactly `gapMs` of silence sits between consecutive sentences. */
export function sentenceOffsets(parts: readonly { words: readonly WordTiming[] }[], gapMs = SENTENCE_GAP_MS): number[] {
  const offsets: number[] = [];
  let offset = 0;
  parts.forEach((part, i) => {
    if (i > 0) {
      const prev = parts[i - 1];
      const prevEnd = offsets[i - 1] + Math.max(...prev.words.map((w) => w.endMs));
      offset = prevEnd + gapMs - part.words[0].startMs;
    }
    offsets.push(Math.max(0, offset));
  });
  return offsets;
}

export function joinArgs(clips: readonly string[], offsetsMs: readonly number[], outPath: string): string[] {
  const inputs = clips.flatMap((c) => ["-i", c]);
  const delayed = offsetsMs.map((ms, i) => `[${i}:a]adelay=${Math.round(ms)}|${Math.round(ms)},aformat=sample_rates=44100:channel_layouts=stereo[s${i}]`);
  const mix = `${offsetsMs.map((_, i) => `[s${i}]`).join("")}amix=inputs=${clips.length}:normalize=0:duration=longest[out]`;
  return ["-y", "-loglevel", "error", ...inputs, "-filter_complex", [...delayed, mix].join(";"), "-map", "[out]", outPath];
}

export type JoinDeps = {
  join: (clips: readonly string[], offsetsMs: readonly number[], outPath: string) => Promise<void>;
  probe: (file: string) => Promise<number>;
};

const defaultDeps: JoinDeps = {
  join: async (clips, offsets, outPath) => {
    await run("ffmpeg", joinArgs(clips, offsets, outPath));
  },
  probe: probeDurationMs,
};

/**
 * Voices each sentence on its own (each clip cached by the inner provider) and joins them with a
 * short, even gap. A one-sentence narration passes straight through.
 */
export function makeSentenceProvider(inner: VoiceProvider, cacheDir: string, deps: JoinDeps = defaultDeps, gapMs = SENTENCE_GAP_MS): VoiceProvider {
  return async (narration, voice): Promise<VoiceResult> => {
    const sentences = splitSentences(narration);
    if (sentences.length <= 1) return inner(narration, voice);
    const parts: VoiceResult[] = [];
    for (const sentence of sentences) parts.push(await inner(sentence, voice));
    const offsets = sentenceOffsets(parts, gapMs);
    const key = createHash("sha256").update(`join\n${gapMs}\n${parts.map((p) => p.audioPath).join("\n")}`).digest("hex").slice(0, 16);
    fs.mkdirSync(cacheDir, { recursive: true });
    const out = path.join(cacheDir, `joined-${key}.wav`);
    if (!fs.existsSync(out)) {
      const tmp = `${out}.part.wav`;
      try {
        await deps.join(parts.map((p) => p.audioPath), offsets, tmp);
        fs.renameSync(tmp, out);
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    }
    const words = parts.flatMap((p, i) => p.words.map((w) => ({ ...w, startMs: w.startMs + offsets[i], endMs: w.endMs + offsets[i] })));
    return { audioPath: out, words, audioMs: await deps.probe(out) };
  };
}
