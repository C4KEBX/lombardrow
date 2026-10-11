import { DEFAULT_TAIL_PAD_MS } from "../schema/timing";
import { MAX_VIDEO_MS, MIN_VIDEO_MS } from "../schema/validate";
import { PRONUNCIATIONS } from "../voice/pronunciations";
import { SENTENCE_GAP_MS, splitSentences } from "../voice/sentences";
import { spellNarration } from "../voice/speller";

/**
 * In en-GB-RyanNeural, the brand voice, voiced sentence by sentence: pooled over two measured scripts of
 * No. 001 (2026-10-09), 156 spoken words in 50.3 s and 190 in 63.4 s of narration, less the per-scene
 * tails and the 0.3 s sentence gaps. Good to about 3 percent there; `npm run voice` has the real length.
 */
export const WORDS_PER_SECOND = 3.34;
export const TARGET_SECONDS = { min: MIN_VIDEO_MS / 1000, max: MAX_VIDEO_MS / 1000 } as const;
/** The door plate lasts as long as the spoken sign-off, about 3 s in en-GB-RyanNeural, and the video ends on it. */
export const CLOSE_ESTIMATE_SECONDS = 3.1;
/** The door-plate close after the narration. The video opens straight on its title card. */
export const BOOKEND_SECONDS = CLOSE_ESTIMATE_SECONDS;
const MID_SECONDS = (TARGET_SECONDS.min + TARGET_SECONDS.max) / 2;
/** Each scene: the tail after its last word plus the next clip's lead-in before its first (about 0.1 s). */
const TAIL_SECONDS = (DEFAULT_TAIL_PAD_MS + 100) / 1000;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Words the voice actually says: "1494" counts as "fourteen ninety-four". */
export const spokenWordCount = (text: string): number => countWords(spellNarration(text, PRONUNCIATIONS).spoken);

/** Narrated length: each scene lasts its spoken words, a 0.3 s gap between its sentences, and a short tail. */
export const narrationSeconds = (narrations: readonly string[], wordsPerSecond = WORDS_PER_SECOND): number =>
  narrations.reduce(
    (sum, n) => sum + spokenWordCount(n) / wordsPerSecond + TAIL_SECONDS + (splitSentences(n).length - 1) * (SENTENCE_GAP_MS / 1000),
    0,
  );

/** Video length: the narrated scenes, then the close. A planning estimate; `npm run voice` has the real number. */
export const estimateSeconds = (narrations: readonly string[]): number => BOOKEND_SECONDS + narrationSeconds(narrations);

/** Total narration words that land at the middle of the length window for a given scene count. */
export const targetWords = (sceneCount: number): number =>
  Math.round((MID_SECONDS - BOOKEND_SECONDS - sceneCount * TAIL_SECONDS) * WORDS_PER_SECOND);
