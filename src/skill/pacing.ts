import type { ComposedScene } from "../pipeline/resolveScene";
import type { Storyboard } from "../schema/storyboard";
import { msToFrame, resolveCue, type WordTiming } from "../schema/timing";
import { SENTENCE_GAP_MS, splitSentences } from "../voice/sentences";
import { synthWords } from "../voice/synthWords";
import { spokenWordCount, WORDS_PER_SECOND } from "./estimate";

/**
 * The fast format's pacing rules (TikTok teardown, 2026-10-10): the picture changes every 2 to 3 s for the first
 * 15 s and no shot runs much past 5 s after that, 20 or more changes a minute; a microhook at least every 10 s;
 * the first 5 s voiced brisk. Times are in seconds.
 */
export const PACING = {
  openWindowS: 15,
  openMaxGapS: 3.2,
  bodyMaxGapS: 5.5,
  minChangesPerMinute: 20,
  hookMaxGapS: 10.5,
  /** The ending may run a little longer after the last microhook: it answers the loop the open planted. */
  lastHookToEndS: 12,
  briskWindowS: 5,
} as const;

/** How much faster a brisk scene is voiced; matches BRISK_RATE in src/voice/types.ts. */
export const BRISK_SPEEDUP = 1.1;

const sec = (frame: number, fps: number): number => frame / fps;

/**
 * Every frame where the picture changes: each cut, each cue (a step, row or callout entering, a word emphasized)
 * and each new shot in a bleed archival scene. Sorted, absolute frames.
 */
export function visualChangeFrames(scenes: readonly ComposedScene[]): number[] {
  const frames = new Set<number>();
  scenes.forEach((s, i) => {
    if (i > 0) frames.add(s.startFrame);
    for (const cue of s.cues) frames.add(s.startFrame + cue.frame);
    for (const shot of s.shotFrames) if (shot > 0) frames.add(s.startFrame + shot);
  });
  return [...frames].sort((a, b) => a - b);
}

/** The reveal ending's comment question popping in is a change of picture too. Unresolvable words are buildVideo's error to report. */
export function endingFrames(sb: Storyboard, last: ComposedScene, fps: number): number[] {
  const ending = sb.meta.ending;
  if (!ending) return [];
  try {
    return [last.startFrame + msToFrame(resolveCue(last.words, ending.atWord, ending.occurrence), fps)];
  } catch {
    return [];
  }
}

/** Where each microhook starts, in absolute frames: the start of its first word. */
export function microhookFrames(scenes: readonly ComposedScene[], fps: number): number[] {
  const out: number[] = [];
  for (const s of scenes) {
    for (const hook of s.scene.microhooks ?? []) {
      const at = s.scene.narration.indexOf(hook);
      if (at < 0) continue;
      const wordIndex = s.scene.narration.slice(0, at).split(/\s+/).filter(Boolean).length;
      const word = s.words[wordIndex];
      if (word) out.push(s.startFrame + Math.round((word.startMs / 1000) * fps));
    }
  }
  return out.sort((a, b) => a - b);
}

/** The fast format's pacing problems for a composed video (real voice or estimated timings). Empty for a classic video. */
export function pacingIssues(sb: Storyboard, scenes: readonly ComposedScene[], fps: number): string[] {
  if (sb.meta.format !== "fast" || scenes.length === 0) return [];
  const issues: string[] = [];
  const last = scenes[scenes.length - 1];
  const endFrame = last.startFrame + last.durationFrames;
  const end = sec(endFrame, fps);

  const changes = [...visualChangeFrames(scenes), ...endingFrames(sb, last, fps)].sort((a, b) => a - b).map((f) => sec(f, fps));
  const stops = [0, ...changes, end];
  for (let i = 1; i < stops.length; i += 1) {
    const from = stops[i - 1];
    const gap = stops[i] - from;
    const limit = from < PACING.openWindowS ? PACING.openMaxGapS : PACING.bodyMaxGapS;
    if (gap > limit + 1e-6) {
      issues.push(`The picture holds for ${gap.toFixed(1)} s from ${from.toFixed(1)} s (${sceneAt(scenes, from * fps)}); ${from < PACING.openWindowS ? `in the first ${PACING.openWindowS} s change it every 2 to 3 s` : `after ${PACING.openWindowS} s no shot runs past about 5 s`}: add a shot, a cue or a cut`);
    }
  }
  const perMinute = (changes.length / end) * 60;
  if (perMinute < PACING.minChangesPerMinute) {
    issues.push(`${changes.length} visual changes in ${end.toFixed(1)} s is ${perMinute.toFixed(1)} a minute; the fast format needs ${PACING.minChangesPerMinute} or more`);
  }

  const hooks = microhookFrames(scenes, fps).map((f) => sec(f, fps));
  if (hooks.length === 0) issues.push(`No scene lists a microhook; put one every 8 to 10 s and list it in that scene's "microhooks"`);
  const hookStops = [0, ...hooks];
  for (let i = 1; i < hookStops.length; i += 1) {
    const gap = hookStops[i] - hookStops[i - 1];
    if (gap > PACING.hookMaxGapS) issues.push(`${gap.toFixed(1)} s pass between microhooks from ${hookStops[i - 1].toFixed(1)} s; add one every 8 to 10 s (list it in the scene's "microhooks")`);
  }
  const lastHook = hookStops[hookStops.length - 1];
  if (hooks.length > 0 && end - lastHook > PACING.lastHookToEndS) {
    issues.push(`${(end - lastHook).toFixed(1)} s pass from the last microhook (${lastHook.toFixed(1)} s) to the end; add one every 8 to 10 s (list it in the scene's "microhooks")`);
  }

  for (const s of scenes) {
    if (sec(s.startFrame, fps) < PACING.briskWindowS && !s.scene.brisk) {
      issues.push(`Scene "${s.id}" starts in the first ${PACING.briskWindowS} s; set "brisk": true so the opening is voiced about 10% faster`);
    }
  }
  return issues;
}

function sceneAt(scenes: readonly ComposedScene[], frame: number): string {
  const found = [...scenes].reverse().find((s) => s.startFrame <= frame);
  return found ? `scene "${found.id}"` : "the open";
}

/**
 * Word timings for `check`, before any voice exists: synthetic words, stretched so each scene lasts what the
 * brand voice would take (brisk scenes about 10% quicker).
 */
export function estimatedWords(scene: { narration: string; brisk?: boolean }): WordTiming[] {
  const synth = synthWords(scene.narration);
  if (synth.length === 0) return synth;
  const speed = WORDS_PER_SECOND * (scene.brisk ? BRISK_SPEEDUP : 1);
  const targetMs = (spokenWordCount(scene.narration) / speed) * 1000 + (splitSentences(scene.narration).length - 1) * SENTENCE_GAP_MS;
  const k = targetMs / synth[synth.length - 1].endMs;
  return synth.map((w) => ({ ...w, startMs: w.startMs * k, endMs: w.endMs * k }));
}
