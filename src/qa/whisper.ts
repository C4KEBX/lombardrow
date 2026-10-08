import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { parseWhisperJson, type HeardWord } from "./listenBack";

const run = promisify(execFile);

export const WHISPER_BIN = process.env.WHISPER_CPP_BIN ?? "whisper-cli";
export const WHISPER_MODEL = process.env.WHISPER_MODEL ?? path.resolve("models/ggml-base.en.bin");

/** Transcribes a video locally with whisper.cpp, one timed segment per word. */
export async function transcribe(videoPath: string, workDir: string, opts: { bin?: string; model?: string } = {}): Promise<HeardWord[]> {
  const model = opts.model ?? WHISPER_MODEL;
  if (!fs.existsSync(model)) throw new Error(`whisper model ${model} not found; run npm run setup:whisper`);
  fs.mkdirSync(workDir, { recursive: true });
  const wav = path.join(workDir, "listen-back.wav");
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  const base = path.join(workDir, "listen-back.whisper");
  try {
    await run(opts.bin ?? WHISPER_BIN, ["-m", model, "-f", wav, "-l", "en", "-ml", "1", "-sow", "-oj", "-of", base, "-np"], { maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") throw new Error(`${opts.bin ?? WHISPER_BIN} not found; run npm run setup:whisper (or set WHISPER_CPP_BIN)`);
    throw error;
  } finally {
    fs.rmSync(wav, { force: true });
  }
  return parseWhisperJson(JSON.parse(fs.readFileSync(`${base}.json`, "utf-8")));
}
