import { WIPE } from "../compose/wipe";
import { easeOutCubic } from "../design/motion";
import { DEVICES } from "../design/tokens";
import type { YearSpan } from "../devices/tracks";

/** One sound effect placed on the timeline. `gainDb` is added to the sound's library gain. */
export type SfxCue = { sound: string; atMs: number; gainDb: number };

/** What the cue sheet reads from the built video: the same frames the devices and wipes animate on. */
export type CueTimeline = {
  scenes: readonly { id: string; startFrame: number; scene: { type: string } }[];
  open: { frames: number };
  close: { startFrame: number };
  years: readonly YearSpan[];
  stamps: readonly { startFrame: number }[];
};

export type ManualCue = { scene: string; sound: string; atMs: number; gainDb?: number };

/** Ticks closer together than this blur into a buzz; the counter skips years faster than that. */
const MIN_TICK_GAP_MS = 70;
/** The counter decelerates, so the ticks thin out and get quieter towards the settled year. */
const TICK_FADE_DB = -6;

/** Scene types that get a sound as they appear. */
const ON_SCENE: Record<string, string> = { archival: "paper-slide", "ledger-page": "page-turn" };

const ms = (frame: number, fps: number) => (frame * 1000) / fps;

/** Ticks while the year counter rolls from one year to the next, one per displayed change. */
export function yearTicks(span: YearSpan, fps: number): SfxCue[] {
  if (span.from === span.to) return [];
  const countFrames = DEVICES.devices.year_counter.motion.count_duration_s * fps;
  const ticks: SfxCue[] = [];
  let shown = span.from;
  let lastMs = -Infinity;
  for (let f = 1; f <= Math.ceil(countFrames); f += 1) {
    const year = Math.round(span.from + (span.to - span.from) * easeOutCubic(f / countFrames));
    if (year === shown) continue;
    shown = year;
    const at = ms(span.startFrame + f, fps);
    if (at - lastMs < MIN_TICK_GAP_MS && year !== span.to) continue;
    ticks.push({ sound: "tick", atMs: at, gainDb: (TICK_FADE_DB * f) / countFrames });
    lastMs = at;
  }
  return ticks;
}

/**
 * The automatic cue sheet: the pen under the open's ledger line, a soft whoosh on each wipe, ticks on
 * the year counter, a thud as each source stamp lands, paper for archival and ledger scenes, and a
 * low hit under the door plate. All quiet: they add texture under the narration, not punctuation.
 */
export function autoCues(t: CueTimeline, fps: number): SfxCue[] {
  const cues: SfxCue[] = [];
  const rule = DEVICES.devices.ledger_line.motion.rule_draw;
  cues.push({ sound: "pen-underline", atMs: rule.start_s * 1000, gainDb: 0 });

  // A wipe covers the frame on each cut after the first scene, and the close follows a wipe too.
  const cuts = [...t.scenes.slice(1).map((s) => s.startFrame), t.close.startFrame];
  for (const cut of cuts) cues.push({ sound: "whoosh-soft", atMs: Math.max(0, ms(cut - WIPE.frames / 2, fps)), gainDb: 0 });

  for (const s of t.scenes) {
    const sound = ON_SCENE[s.scene.type];
    if (sound) cues.push({ sound, atMs: ms(s.startFrame, fps), gainDb: 0 });
  }
  for (const span of t.years) cues.push(...yearTicks(span, fps));
  for (const stamp of t.stamps) cues.push({ sound: "stamp", atMs: ms(stamp.startFrame, fps), gainDb: 0 });
  cues.push({ sound: "low-hit", atMs: ms(t.close.startFrame, fps), gainDb: 0 });
  return cues.sort((a, b) => a.atMs - b.atMs);
}

/** Hand-placed cues, timed from the start of their scene. */
export function manualCues(t: CueTimeline, cues: readonly ManualCue[], fps: number): SfxCue[] {
  return cues.map((c) => {
    const scene = t.scenes.find((s) => s.id === c.scene);
    if (!scene) throw new Error(`Sound cue "${c.sound}" names scene "${c.scene}", which is not in the storyboard`);
    return { sound: c.sound, atMs: ms(scene.startFrame, fps) + c.atMs, gainDb: c.gainDb ?? 0 };
  });
}

/** Every cue for a video; fails on a sound the library does not have, before anything renders. */
export function cueSheet(
  t: CueTimeline, sfx: { auto: boolean; cues: readonly ManualCue[] }, fps: number, known: ReadonlySet<string>,
): SfxCue[] {
  const all = [...(sfx.auto ? autoCues(t, fps) : []), ...manualCues(t, sfx.cues, fps)].sort((a, b) => a.atMs - b.atMs);
  const missing = [...new Set(all.map((c) => c.sound))].filter((s) => !known.has(s));
  if (missing.length) throw new Error(`Sound effect${missing.length > 1 ? "s" : ""} ${missing.map((s) => `"${s}"`).join(", ")} not in sfx/library.json`);
  return all;
}
