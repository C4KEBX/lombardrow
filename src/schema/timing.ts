export type WordTiming = { text: string; startMs: number; endMs: number };

export class CueResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CueResolutionError";
  }
}

export const DEFAULT_TAIL_PAD_MS = 400;

/** Lowercase letters/digits; a '.' survives only between two digits ("1.5" != "15"). */
export const normalizeWord = (word: string): string =>
  word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]/gu, "")
    .replace(/(?<!\d)\.|\.(?!\d)/g, "");

export function resolveCue(words: readonly WordTiming[], atWord: string, occurrence = 1): number {
  const target = normalizeWord(atWord);
  if (!target) {
    throw new CueResolutionError(`Cue word "${atWord}" has no letters or digits`);
  }
  let seen = 0;
  for (const word of words) {
    if (normalizeWord(word.text) === target) {
      seen += 1;
      if (seen === occurrence) return word.startMs;
    }
  }
  throw new CueResolutionError(
    `Cue word "${atWord}" (occurrence ${occurrence}) not found in narration`,
  );
}

export const msToFrame = (ms: number, fps: number): number => Math.round((ms / 1000) * fps);

export function assertValidWords(words: readonly WordTiming[]): void {
  let previousStart = 0;
  for (const word of words) {
    const finite = Number.isFinite(word.startMs) && Number.isFinite(word.endMs);
    if (!finite || word.startMs < 0 || word.endMs < word.startMs) {
      throw new CueResolutionError(
        `Invalid timing for word "${word.text}": start ${word.startMs}ms, end ${word.endMs}ms`,
      );
    }
    if (word.startMs < previousStart) {
      throw new CueResolutionError(`Word "${word.text}" is out of order (starts at ${word.startMs}ms)`);
    }
    previousStart = word.startMs;
  }
}

export function sceneDurationMs(
  words: readonly WordTiming[],
  tailPadMs = DEFAULT_TAIL_PAD_MS,
): number {
  if (words.length === 0) {
    throw new CueResolutionError("Cannot derive scene duration from empty word timings");
  }
  return Math.max(...words.map((word) => word.endMs)) + tailPadMs;
}
