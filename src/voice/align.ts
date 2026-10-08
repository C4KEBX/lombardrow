import { normalizeWord, type WordTiming } from "../schema/timing";

export type RawEvent = { text: string; startMs: number; endMs: number };

export class VoiceAlignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceAlignmentError";
  }
}

/** Rough spoken length of a token: digits and symbols take longer to say than their characters suggest. */
export function spokenWeight(token: string): number {
  let weight = 0;
  for (const ch of token) {
    if (/\p{L}/u.test(ch)) weight += 1;
    else if (/\p{N}/u.test(ch)) weight += 2;
    else if (ch === "%" || ch === "$") weight += 6;
    else if (ch === "&") weight += 3;
  }
  return Math.max(weight, 1);
}

const normalizedEventText = (text: string): string =>
  text.split(/\s+/).filter(Boolean).map(normalizeWord).join("");

type Range = { start: number; end: number };

function ranges(parts: readonly string[]): Range[] {
  let cursor = 0;
  return parts.map((part) => {
    const range = { start: cursor, end: cursor + part.length };
    cursor = range.end;
    return range;
  });
}

/**
 * Maps voice word events onto the narration's own tokens. Events may merge several tokens (Edge
 * does this for numbers and dates) or split one token; the narration and the events must spell the
 * same letters and digits. Merged events are divided between their tokens by spoken weight.
 */
export function alignEvents(narration: string, events: readonly RawEvent[]): WordTiming[] {
  const tokens = narration.split(/\s+/).filter(Boolean);
  const kept = tokens
    .map((text, index) => ({ text, index, norm: normalizeWord(text) }))
    .filter((t) => t.norm.length > 0);
  if (kept.length === 0) return [];

  const usable = events
    .map((event) => ({ event, norm: normalizedEventText(event.text) }))
    .filter((e) => e.norm.length > 0);
  if (usable.length === 0) throw new VoiceAlignmentError("The voice returned no word events for the narration");

  const tokenStream = kept.map((t) => t.norm).join("");
  const eventStream = usable.map((e) => e.norm).join("");
  if (tokenStream !== eventStream) {
    let i = 0;
    while (i < tokenStream.length && tokenStream[i] === eventStream[i]) i += 1;
    throw new VoiceAlignmentError(
      `The voice's words differ from the narration near "${tokenStream.slice(Math.max(0, i - 8), i + 12)}" (voice said "${eventStream.slice(Math.max(0, i - 8), i + 12)}")`,
    );
  }

  const tokenRanges = ranges(kept.map((t) => t.norm));
  const eventRanges = ranges(usable.map((e) => e.norm));
  const starts = new Array<number>(kept.length).fill(Infinity);
  const ends = new Array<number>(kept.length).fill(-Infinity);

  usable.forEach(({ event }, ei) => {
    const er = eventRanges[ei];
    const pieces: { token: number; weight: number }[] = [];
    kept.forEach((token, ti) => {
      const tr = tokenRanges[ti];
      const overlap = Math.min(tr.end, er.end) - Math.max(tr.start, er.start);
      if (overlap > 0) {
        pieces.push({ token: ti, weight: (spokenWeight(token.text) * overlap) / (tr.end - tr.start) });
      }
    });
    const total = pieces.reduce((sum, p) => sum + p.weight, 0);
    const span = event.endMs - event.startMs;
    let cursor = event.startMs;
    for (const piece of pieces) {
      const length = (span * piece.weight) / total;
      starts[piece.token] = Math.min(starts[piece.token], cursor);
      ends[piece.token] = Math.max(ends[piece.token], cursor + length);
      cursor += length;
    }
  });

  // Tokens with no letters or digits ("&", "—") are kept as zero-length words so captions show the
  // narration as written; they never match a cue (their normalized form is empty).
  const timed = new Map(kept.map((token, ti) => [token.index, { startMs: starts[ti], endMs: ends[ti] }]));
  const nextStart = (from: number): number | undefined => {
    for (let i = from + 1; i < tokens.length; i += 1) if (timed.has(i)) return timed.get(i)?.startMs;
    return undefined;
  };
  const result: WordTiming[] = [];
  tokens.forEach((text, i) => {
    const own = timed.get(i);
    if (own) {
      result.push({ text, ...own });
      return;
    }
    const previous = result[result.length - 1];
    const following = nextStart(i);
    const at = previous ? Math.min(previous.endMs, following ?? previous.endMs) : (following as number);
    result.push({ text, startMs: at, endMs: at });
  });
  return result;
}
