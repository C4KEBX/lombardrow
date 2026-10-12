import fs from "node:fs";
import path from "node:path";
import { SIGNOFF } from "../devices/tracks";
import type { VoiceProvider, VoiceResult } from "./types";

/** Where the approved sign-off takes live, one per voice: `<voice>.mp3` and `<voice>.json`. */
export const SIGNOFF_DIR = path.resolve("src/brand/signoff");

/** The approved, hand-edited sign-off clip for this voice, if there is one. */
export function brandSignoff(voice: string, dir = SIGNOFF_DIR): VoiceResult | undefined {
  const audioPath = path.join(dir, `${voice}.mp3`);
  const meta = path.join(dir, `${voice}.json`);
  if (!fs.existsSync(audioPath) || !fs.existsSync(meta)) return undefined;
  const { audioMs, words } = JSON.parse(fs.readFileSync(meta, "utf-8")) as Pick<VoiceResult, "audioMs" | "words">;
  return { audioPath, audioMs, words };
}

/** Every video ends on the same take: the approved clip when the voice has one, else a fresh read. */
export async function voiceSignoff(provider: VoiceProvider, voice: string, dir = SIGNOFF_DIR): Promise<VoiceResult> {
  return brandSignoff(voice, dir) ?? provider(SIGNOFF, voice);
}
