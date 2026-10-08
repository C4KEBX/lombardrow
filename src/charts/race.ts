import { clamp01, easeInOutCubic } from "../design/motion";

export type RaceValue = { name: string; value: number };
export type RaceFrame = { label: string; values: RaceValue[] };
/** `present` is 1 when the dataset lists the entity, fading 0..1 across the frames where it enters or exits. */
export type RaceBar = {
  name: string;
  value: number;
  rank: number;
  opacity: number;
  present: number;
  colorIndex: number;
};
export type RaceState = { bars: RaceBar[]; label: string; axisMax: number };

const AXIS_HEADROOM = 1.08;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function namesInOrder(frames: readonly RaceFrame[]): string[] {
  const seen = new Set<string>();
  for (const frame of frames) for (const v of frame.values) seen.add(v.name);
  return [...seen];
}

/** Value per name for a frame; entities missing from the frame count as 0. */
function valuesAt(frame: RaceFrame, names: readonly string[]): Map<string, number> {
  const byName = new Map(frame.values.map((v) => [v.name, v.value]));
  return new Map(names.map((name) => [name, byName.get(name) ?? 0]));
}

function presenceAt(frame: RaceFrame, names: readonly string[]): Map<string, number> {
  const listed = new Set(frame.values.map((v) => v.name));
  return new Map(names.map((name) => [name, listed.has(name) ? 1 : 0]));
}

function ranksOf(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return new Map(sorted.map(([name], index) => [name, index]));
}

/**
 * State of a bar race at fractional keyframe index `t`. Values move linearly; ranks swap with an
 * ease-in-out so overtakes read clearly. Bars below `topN` fade out and are omitted at opacity 0.
 */
export function raceStateAt(frames: readonly RaceFrame[], t: number, topN: number): RaceState {
  if (frames.length === 0) throw new RangeError("frames must not be empty");
  const names = namesInOrder(frames);
  const tc = Math.min(Math.max(t, 0), frames.length - 1);
  const k = Math.min(Math.floor(tc), Math.max(frames.length - 2, 0));
  const next = Math.min(k + 1, frames.length - 1);
  const f = frames.length === 1 ? 0 : tc - k;
  const u = easeInOutCubic(f);

  const a = valuesAt(frames[k], names);
  const b = valuesAt(frames[next], names);
  const pa = presenceAt(frames[k], names);
  const pb = presenceAt(frames[next], names);
  const ra = ranksOf(a);
  const rb = ranksOf(b);

  const bars = names
    .map((name, colorIndex) => {
      const rank = lerp(ra.get(name) as number, rb.get(name) as number, u);
      const present = lerp(pa.get(name) as number, pb.get(name) as number, f);
      return {
        name,
        value: lerp(a.get(name) as number, b.get(name) as number, f),
        rank,
        opacity: Math.min(clamp01(topN - rank), present),
        present,
        colorIndex,
      };
    })
    .filter((bar) => bar.opacity > 0)
    .sort((x, y) => x.rank - y.rank || x.name.localeCompare(y.name));

  const maxOf = (m: Map<string, number>) => Math.max(...m.values());
  const axis = lerp(maxOf(a), maxOf(b), f) * AXIS_HEADROOM;
  return {
    bars,
    label: frames[Math.min(Math.round(tc), frames.length - 1)].label,
    axisMax: axis > 0 ? axis : 1,
  };
}
