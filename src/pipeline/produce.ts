import fs from "node:fs";
import path from "node:path";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { assertLoudnessOk, type LoudnormMeasure } from "../audio/graph";
import { measureLoudness, mixAudio } from "../audio/mix";
import { cueSheet } from "../audio/cues";
import { loadSfxLibrary } from "../audio/library";
import { resolveMusic } from "../audio/music";
import { MUSIC_BED_DB } from "../audio/graph";
import { VIDEO } from "../design/tokens";
import { parseStoryboard } from "../schema/storyboard";
import { assertDuration } from "../schema/validate";
import { makeVoiceProvider, type VoiceMode } from "../voice/index";
import type { VoiceResult } from "../voice/types";
import { SIGNOFF } from "../devices/tracks";
import { imagesFor } from "./assets";
import { buildVideo, videoProps } from "./buildVideo";
import { browserExecutable, getServeUrl, renderConcurrency } from "./bundle";
import { encodeFrames } from "./encode";
import { muxVideoAudio } from "./finish";

export type ProduceOptions = {
  storyboardPath: string;
  factsPath: string;
  outDir: string;
  voice: VoiceMode;
  enforceLength: boolean;
  musicDir?: string;
  sfxDir?: string;
  cacheDir?: string;
  /** assets.json for archival scenes; defaults to the one next to the storyboard. */
  assetsPath?: string;
};

export type ProduceResult = {
  videoPath: string;
  totalFrames: number;
  durationMs: number;
  loudness: LoudnormMeasure;
  manifestPath: string;
};

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));

/** Storyboard + facts -> narrated, captioned, mixed final.mp4. Voice runs scene by scene (polite to Edge). */
export async function produce(opts: ProduceOptions): Promise<ProduceResult> {
  const storyboardJson = readJson(opts.storyboardPath);
  const factsJson = readJson(opts.factsPath);
  const storyboard = parseStoryboard(storyboardJson);

  const provider = makeVoiceProvider(opts.voice, opts.cacheDir ?? path.resolve("out/voice-cache"));
  const voices: Record<string, VoiceResult> = {};
  for (const scene of storyboard.scenes) voices[scene.id] = await provider(scene.narration, storyboard.meta.voice);
  // The same sign-off every video; the voice cache keys on text and voice, so this synthesizes once.
  const signoff = await provider(SIGNOFF, storyboard.meta.voice);

  const built = buildVideo(
    storyboardJson,
    factsJson,
    () => Object.fromEntries(Object.entries(voices).map(([id, v]) => [id, v.words])),
    VIDEO.fps,
    signoff.audioMs,
    imagesFor(opts.storyboardPath, opts.assetsPath),
  );
  const totalMs = (built.totalFrames / VIDEO.fps) * 1000;
  if (opts.enforceLength) assertDuration(totalMs);

  fs.mkdirSync(opts.outDir, { recursive: true });
  // Resolve music before rendering so an unsafe or missing name fails fast.
  const music = await resolveMusic(
    storyboard.audio.music, totalMs / 1000, opts.musicDir ?? path.resolve("music"), opts.outDir,
  );
  const sfxLib = loadSfxLibrary(opts.sfxDir ?? path.resolve("sfx"));
  const sounds = new Map(sfxLib.sounds.map((s) => [s.id, s]));
  const cues = cueSheet(built, storyboard.audio.sfx, VIDEO.fps, new Set(sounds.keys()));

  const inputProps = videoProps(built);
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, browserExecutable: browserExecutable(), id: "Production", inputProps });
  const framesDir = path.join(opts.outDir, "frames");
  fs.rmSync(framesDir, { recursive: true, force: true });
  await renderFrames({
    composition, serveUrl, browserExecutable: browserExecutable(), inputProps, outputDir: framesDir, imageFormat: "jpeg",
    concurrency: renderConcurrency(),
    onStart: () => undefined, onFrameUpdate: () => undefined,
  });
  const silentPath = path.join(opts.outDir, "silent.mp4");
  await encodeFrames(framesDir, VIDEO.fps, silentPath);

  const audioPath = path.join(opts.outDir, "audio.m4a");
  const clips = [
    ...built.scenes.map((scene) => ({
      path: voices[scene.id].audioPath,
      startMs: (scene.startFrame * 1000) / VIDEO.fps,
    })),
    { path: signoff.audioPath, startMs: (built.close.startFrame * 1000) / VIDEO.fps },
  ];
  await mixAudio({
    clips,
    musicPath: music?.path,
    // Library beds share one loudness; the ambient drone keeps its own level.
    musicGainDb: music?.track ? MUSIC_BED_DB + music.gainDb : undefined,
    sfx: cues.map((c) => {
      const sound = sounds.get(c.sound)!;
      return { path: path.join(sfxLib.dir, sound.file), atMs: c.atMs, gainDb: sound.gainDb + c.gainDb };
    }),
    totalMs,
    outPath: audioPath,
  });

  const videoPath = path.join(opts.outDir, "final.mp4");
  await muxVideoAudio(silentPath, audioPath, videoPath);
  const loudness = await measureLoudness(videoPath);
  assertLoudnessOk(loudness);

  const manifestPath = path.join(opts.outDir, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        voice: opts.voice,
        totalFrames: built.totalFrames,
        durationMs: totalMs,
        loudness,
        music: storyboard.audio.music,
        musicCredit: music?.track?.credit ?? null,
        sfx: cues.map((c) => ({ sound: c.sound, atMs: Math.round(c.atMs), gainDb: Number(c.gainDb.toFixed(2)) })),
        // Every caption word with its time, for npm run listen-back.
        captions: built.captions.flatMap((c) => c.words.map((w) => ({ text: w.text, startMs: Math.round(w.startMs), endMs: Math.round(w.endMs) }))),
        signoff: SIGNOFF,
        scenes: built.scenes.map((s) => ({
          id: s.id, type: s.scene.type, startFrame: s.startFrame, durationFrames: s.durationFrames,
          cues: s.cues, audio: voices[s.id].audioPath,
        })),
      },
      null,
      2,
    ),
  );
  return { videoPath, totalFrames: built.totalFrames, durationMs: totalMs, loudness, manifestPath };
}
