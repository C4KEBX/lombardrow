import fs from "node:fs";
import { VIDEO } from "../design/tokens";
import { SIGNOFF } from "../devices/tracks";
import { parseStoryboard } from "../schema/storyboard";
import { MAX_VIDEO_MS, MIN_VIDEO_MS } from "../schema/validate";
import type { VoiceProvider, VoiceResult } from "../voice/types";
import { imagesFor } from "./assets";
import { buildVideo } from "./buildVideo";

export type VoiceReport = {
  scenes: { id: string; voiceMs: number; sceneMs: number }[];
  openMs: number;
  closeMs: number;
  totalMs: number;
  withinGate: boolean;
};

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));
const framesMs = (frames: number) => (frames * 1000) / VIDEO.fps;

/**
 * Voices every scene and the sign-off, then lays the video out exactly as produce would, without
 * rendering. Gives the true length before the review gate; voice output is cached for produce.
 */
export async function voiceCheck(storyboardPath: string, factsPath: string, provider: VoiceProvider): Promise<VoiceReport> {
  const storyboardJson = readJson(storyboardPath);
  const storyboard = parseStoryboard(storyboardJson);
  const voices: Record<string, VoiceResult> = {};
  for (const scene of storyboard.scenes) voices[scene.id] = await provider(scene.narration, storyboard.meta.voice);
  const signoff = await provider(SIGNOFF, storyboard.meta.voice);

  const built = buildVideo(
    storyboardJson,
    readJson(factsPath),
    () => Object.fromEntries(Object.entries(voices).map(([id, v]) => [id, v.words])),
    VIDEO.fps,
    Object.fromEntries(Object.entries(voices).map(([id, v]) => [id, v.audioMs])),
    signoff.audioMs,
    imagesFor(storyboardPath),
  );
  const totalMs = framesMs(built.totalFrames);
  return {
    scenes: built.scenes.map((s) => ({ id: s.id, voiceMs: voices[s.id].audioMs, sceneMs: framesMs(s.durationFrames) })),
    openMs: framesMs(built.open.frames),
    closeMs: framesMs(built.close.frames),
    totalMs,
    withinGate: totalMs >= MIN_VIDEO_MS && totalMs <= MAX_VIDEO_MS,
  };
}

const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function formatVoiceReport(report: VoiceReport): string {
  const width = Math.max(6, ...report.scenes.map((x) => x.id.length));
  const lines = [
    `${"scene".padEnd(width)}  voice   on screen`,
    `${"(open)".padEnd(width)}      -   ${s(report.openMs)}`,
    ...report.scenes.map((x) => `${x.id.padEnd(width)}  ${s(x.voiceMs).padStart(5)}   ${s(x.sceneMs)}`),
    `${"(door)".padEnd(width)}      -   ${s(report.closeMs)}`,
    "",
    `Total ${s(report.totalMs)} (gate ${MIN_VIDEO_MS / 1000}-${MAX_VIDEO_MS / 1000}s): ${
      report.withinGate ? "OK" : report.totalMs < MIN_VIDEO_MS ? `SHORT by ${s(MIN_VIDEO_MS - report.totalMs)}` : `LONG by ${s(report.totalMs - MAX_VIDEO_MS)}`
    }`,
  ];
  return lines.join("\n");
}
