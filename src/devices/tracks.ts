import { DEVICES } from "../design/tokens";

const fpsFrames = (seconds: number, fps: number) => Math.round(seconds * fps);

/** The ledger-line open: 2 s of every video, before the first narrated scene. */
export const OPEN_SECONDS = 2;
/** The door-plate close: at least 3 s (devices.json), longer if the spoken sign-off needs it. */
export const CLOSE_SECONDS = DEVICES.devices.door_plate.motion.duration_s;
/** Spoken over the door plate in every video, from one cached voice clip. */
export const SIGNOFF = "Lombard Row. How money got this way.";

export const openFrames = (fps: number): number => fpsFrames(OPEN_SECONDS, fps);
export const closeFrames = (fps: number, signoffAudioMs = 0, tailMs = 400): number =>
  Math.max(fpsFrames(CLOSE_SECONDS, fps), Math.ceil(((signoffAudioMs + tailMs) / 1000) * fps));

export type YearSpan = {
  /** Year shown when the span starts (counts from here), and the year it settles on. */
  from: number;
  to: number;
  startFrame: number;
  endFrame: number;
  /** Fade in at the start / out at the end (the counter was hidden before / is hidden after). */
  fadeIn: boolean;
  fadeOut: boolean;
};

/**
 * One span per scene that sets a year. Consecutive year scenes count from the previous year to the
 * next; a scene without a year (the present) hides the counter.
 */
export function yearTrack(scenes: readonly { startFrame: number; durationFrames: number; year?: number }[]): YearSpan[] {
  const spans: YearSpan[] = [];
  scenes.forEach((scene, i) => {
    if (scene.year === undefined) return;
    const prev = i > 0 ? scenes[i - 1].year : undefined;
    const next = i + 1 < scenes.length ? scenes[i + 1].year : undefined;
    spans.push({
      from: prev ?? scene.year,
      to: scene.year,
      startFrame: scene.startFrame,
      endFrame: scene.startFrame + scene.durationFrames,
      fadeIn: prev === undefined,
      fadeOut: next === undefined,
    });
  });
  return spans;
}

export type StampSpan = { text: string; startFrame: number; endFrame: number };

export class StampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StampError";
  }
}

export const MAX_STAMP_CHARS = DEVICES.devices.source_stamp.max_chars;

/**
 * Source stamps for the scenes that state a number or date. A stamp holds at least the minimum
 * (2 s), running into the next scene if its own is shorter; the same text across scenes stays one
 * stamp. Over-long text fails: the stamp is never truncated.
 */
export function stampTrack(
  scenes: readonly { id: string; startFrame: number; durationFrames: number; stamp?: string }[],
  fps: number,
): StampSpan[] {
  const minHold = fpsFrames(DEVICES.devices.source_stamp.motion.min_hold_s, fps);
  const spans: StampSpan[] = [];
  for (const scene of scenes) {
    if (scene.stamp === undefined) continue;
    if (scene.stamp.length > MAX_STAMP_CHARS) {
      throw new StampError(
        `Scene "${scene.id}": source stamp "${scene.stamp}" is ${scene.stamp.length} characters; the limit is ${MAX_STAMP_CHARS}. Give the fact a shorter source stamp.`,
      );
    }
    const end = scene.startFrame + scene.durationFrames;
    const last = spans[spans.length - 1];
    if (last && last.text === scene.stamp && last.endFrame >= scene.startFrame) {
      last.endFrame = Math.max(last.endFrame, end);
      continue;
    }
    const start = last ? Math.max(scene.startFrame, last.endFrame) : scene.startFrame;
    spans.push({ text: scene.stamp, startFrame: start, endFrame: Math.max(end, start + minHold) });
  }
  return spans;
}
