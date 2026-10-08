import type { PNG } from "pngjs";

const CHANNEL_SUM_THRESHOLD = 48; // ignores antialiasing-level noise

export function diffRatio(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const pixels = a.width * a.height;
  let changed = 0;
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    const delta =
      Math.abs(a.data[o] - b.data[o]) +
      Math.abs(a.data[o + 1] - b.data[o + 1]) +
      Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (delta > CHANNEL_SUM_THRESHOLD) changed += 1;
  }
  return changed / pixels;
}
