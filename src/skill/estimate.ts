import { CLOSE_SECONDS, OPEN_SECONDS } from "../devices/tracks";
import { DEFAULT_TAIL_PAD_MS } from "../schema/timing";
import { PRONUNCIATIONS } from "../voice/pronunciations";
import { spellNarration } from "../voice/speller";

/** Pooled over six real Edge runs (665 words in 232.8 s of audio): 2.85 words per second. Individual videos ranged 2.50 to 3.18, so an estimate is good to about 10 percent; `npm run voice` has the real length. */
export const WORDS_PER_SECOND = 2.85;
export const TARGET_SECONDS = { min: 65, max: 70 } as const;
/** The fixed ledger-line open and door-plate close around the narration. */
export const BOOKEND_SECONDS = OPEN_SECONDS + CLOSE_SECONDS;
const MID_SECONDS = (TARGET_SECONDS.min + TARGET_SECONDS.max) / 2;
const TAIL_SECONDS = DEFAULT_TAIL_PAD_MS / 1000;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Words the voice actually says: "1494" counts as "fourteen ninety-four". */
export const spokenWordCount = (text: string): number => countWords(spellNarration(text, PRONUNCIATIONS).spoken);

/** Narrated length: each scene lasts its narration plus a short tail. */
export const narrationSeconds = (narrations: readonly string[]): number =>
  narrations.reduce((sum, n) => sum + spokenWordCount(n) / WORDS_PER_SECOND + TAIL_SECONDS, 0);

/** Video length: the open, the narrated scenes, then the close. A planning estimate; `npm run voice` has the real number. */
export const estimateSeconds = (narrations: readonly string[]): number => BOOKEND_SECONDS + narrationSeconds(narrations);

/** Total narration words that land at the middle of the 65-70 s window for a given scene count. */
export const targetWords = (sceneCount: number): number =>
  Math.round((MID_SECONDS - BOOKEND_SECONDS - sceneCount * TAIL_SECONDS) * WORDS_PER_SECOND);
