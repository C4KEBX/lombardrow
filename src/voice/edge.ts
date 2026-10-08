import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { probeDurationMs } from "../audio/probe";
import { alignEvents, type RawEvent } from "./align";
import type { VoiceProvider } from "./types";

const run = promisify(execFile);

export const TTS_PYTHON = path.resolve("tts/.venv/bin/python");
export const TTS_SCRIPT = path.resolve("tts/tts.py");

const EventsSchema = z.array(
  z.strictObject({ text: z.string(), startMs: z.number(), endMs: z.number() }),
);

export const voiceCacheKey = (voice: string, narration: string): string =>
  createHash("sha256").update(`${voice}\n${narration}`).digest("hex").slice(0, 16);

export const ttsArgs = (voice: string, textFile: string, outMp3: string, outJson: string): string[] => [
  TTS_SCRIPT, "--voice", voice, "--text-file", textFile, "--out-mp3", outMp3, "--out-json", outJson,
];

export function parseEvents(raw: string): RawEvent[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Edge TTS events file is not valid JSON");
  }
  const parsed = EventsSchema.safeParse(json);
  if (!parsed.success) throw new Error(`Edge TTS events have the wrong shape: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

export type EdgeDeps = {
  runTts: (args: string[]) => Promise<void>;
  probe: (file: string) => Promise<number>;
};

const defaultDeps: EdgeDeps = {
  runTts: async (args) => {
    try {
      await run(TTS_PYTHON, args);
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr?.trim();
      throw new Error(
        `Edge TTS failed: ${stderr || (error as Error).message}. Run "npm run setup:tts" and check your network connection.`,
      );
    }
  },
  probe: probeDurationMs,
};

/** Edge TTS provider. Output is cached per (voice, narration); a failed run caches nothing. */
export function makeEdgeProvider(cacheDir: string, deps: EdgeDeps = defaultDeps): VoiceProvider {
  return async (narration, voice) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const key = voiceCacheKey(voice, narration);
    const mp3 = path.join(cacheDir, `${key}.mp3`);
    const json = path.join(cacheDir, `${key}.events.json`);
    if (!(fs.existsSync(mp3) && fs.existsSync(json))) {
      const textFile = path.join(cacheDir, `${key}.txt`);
      const tmpMp3 = `${mp3}.part`;
      const tmpJson = `${json}.part`;
      fs.writeFileSync(textFile, narration, "utf-8");
      try {
        await deps.runTts(ttsArgs(voice, textFile, tmpMp3, tmpJson));
        fs.renameSync(tmpMp3, mp3);
        fs.renameSync(tmpJson, json);
      } finally {
        fs.rmSync(tmpMp3, { force: true });
        fs.rmSync(tmpJson, { force: true });
      }
    }
    const events = parseEvents(fs.readFileSync(json, "utf-8"));
    return { audioPath: mp3, words: alignEvents(narration, events), audioMs: await deps.probe(mp3) };
  };
}
