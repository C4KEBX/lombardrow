import type { WordTiming } from "../schema/timing";

export type CaptionWord = WordTiming;
export type CaptionChunk = { startMs: number; endMs: number; words: CaptionWord[] };

export const CAPTION_MAX_CHARS = 24;
export const CAPTION_MAX_WORDS = 4;
export const CAPTION_HOLD_MS = 250;
export const CAPTION_GAP_BREAK_MS = 500;

const SENTENCE_END = /[.!?]["')\]]*$/;

export function chunkWords(words: readonly CaptionWord[]): CaptionChunk[] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  for (const word of words) {
    const previous = current[current.length - 1];
    if (previous) {
      const joined = [...current, word].map((x) => x.text).join(" ");
      const mustBreak =
        joined.length > CAPTION_MAX_CHARS ||
        current.length >= CAPTION_MAX_WORDS ||
        word.startMs - previous.endMs > CAPTION_GAP_BREAK_MS ||
        SENTENCE_END.test(previous.text);
      if (mustBreak) {
        groups.push(current);
        current = [];
      }
    }
    current.push(word);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group, i) => {
    const last = group[group.length - 1];
    const nextStart = i + 1 < groups.length ? groups[i + 1][0].startMs : Infinity;
    return {
      startMs: group[0].startMs,
      endMs: Math.max(last.endMs, Math.min(last.endMs + CAPTION_HOLD_MS, nextStart)),
      words: group.map((x) => ({ ...x })),
    };
  });
}

export const chunkAt = (chunks: readonly CaptionChunk[], ms: number): CaptionChunk | undefined =>
  chunks.find((chunk) => ms >= chunk.startMs && ms < chunk.endMs);

/** Index of the last word that has started by `ms` (-1 before the first word). */
export function activeWordIndex(chunk: CaptionChunk, ms: number): number {
  let index = -1;
  chunk.words.forEach((word, i) => {
    if (word.startMs <= ms) index = i;
  });
  return index;
}

export function buildCaptions(
  scenes: readonly { startFrame: number; words: readonly WordTiming[] }[],
  fps: number,
): CaptionChunk[] {
  const global = scenes.flatMap((scene) => {
    const offset = (scene.startFrame * 1000) / fps;
    return scene.words.map((word) => ({
      text: word.text,
      startMs: word.startMs + offset,
      endMs: word.endMs + offset,
    }));
  });
  return chunkWords(global);
}
