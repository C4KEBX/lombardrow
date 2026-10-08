import { CLOSE_SECONDS, OPEN_SECONDS } from "../devices/tracks";
import { DEFAULT_TAIL_PAD_MS } from "../schema/timing";
import { PRONUNCIATIONS } from "../voice/pronunciations";
import { spellNarration } from "../voice/speller";

/**
 * Measured on No. 004 in en-GB-RyanNeural, the brand voice (159 spoken words in 59.8 s of scene audio,
 * 2026-10-08). The earlier en-US-AndrewNeural runs pooled at 2.85 and ranged 2.50 to 3.18 per video,
 * so an estimate is good to about 10 percent; `npm run voice` has the real length.
 */
export const WORDS_PER_SECOND = 2.66;
/** en-US-AndrewNeural, pooled over six real runs (665 words in 232.8 s of audio). */
export const ANDREW_WORDS_PER_SECOND = 2.85;
export const TARGET_SECONDS = { min: 65, max: 70 } as const;
/** The door plate holds for the spoken sign-off plus a short tail; in en-GB-RyanNeural that measured 4.6 s. */
export const CLOSE_ESTIMATE_SECONDS = Math.max(CLOSE_SECONDS, 4.6);
/** The fixed ledger-line open and door-plate close around the narration. */
export const BOOKEND_SECONDS = OPEN_SECONDS + CLOSE_ESTIMATE_SECONDS;
const MID_SECONDS = (TARGET_SECONDS.min + TARGET_SECONDS.max) / 2;
const TAIL_SECONDS = DEFAULT_TAIL_PAD_MS / 1000;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Words the voice actually says: "1494" counts as "fourteen ninety-four". */
export const spokenWordCount = (text: string): number => countWords(spellNarration(text, PRONUNCIATIONS).spoken);

/** Narrated length: each scene lasts its narration plus a short tail. */
export const narrationSeconds = (narrations: readonly string[], wordsPerSecond = WORDS_PER_SECOND): number =>
  narrations.reduce((sum, n) => sum + spokenWordCount(n) / wordsPerSecond + TAIL_SECONDS, 0);

/** Video length: the open, the narrated scenes, then the close. A planning estimate; `npm run voice` has the real number. */
export const estimateSeconds = (narrations: readonly string[]): number => BOOKEND_SECONDS + narrationSeconds(narrations);

/** Total narration words that land at the middle of the 65-70 s window for a given scene count. */
export const targetWords = (sceneCount: number): number =>
  Math.round((MID_SECONDS - BOOKEND_SECONDS - sceneCount * TAIL_SECONDS) * WORDS_PER_SECOND);
