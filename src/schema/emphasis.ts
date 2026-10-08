import { normalizeWord } from "./timing";

export type EmphasisTarget = { line: number; word: number };

/** The on-screen word an `emphasize` cue points at: the first word of the lines that matches `text`. */
export function emphasisTarget(lines: readonly string[], text: string): EmphasisTarget | null {
  const want = normalizeWord(text);
  if (want === "") return null;
  for (let line = 0; line < lines.length; line += 1) {
    const word = lines[line].split(/\s+/).filter(Boolean).findIndex((w) => normalizeWord(w) === want);
    if (word >= 0) return { line, word };
  }
  return null;
}

/** Frame of the emphasize cue that targets each item, in item order. Throws if an item has no cue. */
export function itemCueFrames(
  items: readonly string[],
  cues: readonly { frame: number; do: string; text?: string }[],
): number[] {
  const frames = new Array<number | undefined>(items.length).fill(undefined);
  for (const cue of cues) {
    if (cue.do !== "emphasize" || cue.text === undefined) continue;
    const target = emphasisTarget(items, cue.text);
    if (target) frames[target.line] = cue.frame;
  }
  const missing = frames.findIndex((f) => f === undefined);
  if (missing >= 0) throw new RangeError(`"${items[missing]}" has no emphasize cue`);
  return frames as number[];
}
