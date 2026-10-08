import { DEFAULT_TAIL_PAD_MS } from "../schema/timing";

/** Pooled over six real Edge runs (665 words in 232.8 s of audio): 2.85 words per second. Individual videos ranged 2.50 to 3.18, so an estimate is good to about 10 percent; `produce` has the real length. */
export const WORDS_PER_SECOND = 2.85;
export const TARGET_SECONDS = { min: 55, max: 60 } as const;
const MID_SECONDS = (TARGET_SECONDS.min + TARGET_SECONDS.max) / 2;
const TAIL_SECONDS = DEFAULT_TAIL_PAD_MS / 1000;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Video length: each scene lasts its narration plus a short tail. A planning estimate; `produce` has the real number. */
export const estimateSeconds = (narrations: readonly string[]): number =>
  narrations.reduce((sum, n) => sum + countWords(n) / WORDS_PER_SECOND + TAIL_SECONDS, 0);

/** Total narration words that land at the middle of the 55-60 s window for a given scene count. */
export const targetWords = (sceneCount: number): number =>
  Math.round((MID_SECONDS - sceneCount * TAIL_SECONDS) * WORDS_PER_SECOND);
