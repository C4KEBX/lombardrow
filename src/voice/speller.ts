import type { WordTiming } from "../schema/timing";

/**
 * The number speller. Scripts and captions keep digits ("1494", "$1,000", "8%"); the voice reads a
 * spoken form ("fourteen ninety-four", "one thousand dollars", "eight percent"). Each written token
 * maps to the spoken words that say it, so word timings from the voice fold back onto the written
 * tokens and cues and captions keep working on what the script says.
 */

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
const SCALE_WORDS = new Set(["thousand", "million", "billion", "trillion"]);

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function underThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return underHundred(rest);
  return rest ? `${ONES[h]} hundred and ${underHundred(rest)}` : `${ONES[h]} hundred`;
}

/** Cardinal words for a whole number, British style ("one hundred and five"). */
export function cardinal(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`cardinal() needs a whole number >= 0, got ${n}`);
  if (n < 1000) return underThousand(n);
  const parts: string[] = [];
  let rest = n;
  for (const [size, word] of SCALES) {
    if (rest >= size) {
      parts.push(`${cardinal(Math.floor(rest / size))} ${word}`);
      rest %= size;
    }
  }
  if (rest) parts.push(rest < 100 ? `and ${underHundred(rest)}` : underThousand(rest));
  return parts.join(" ");
}

/** How a year is said: 1494 "fourteen ninety-four", 1905 "nineteen oh five", 2008 "two thousand and eight", 1900 "nineteen hundred". */
export function yearWords(year: number): string {
  if (year >= 2000 && year < 2010) return year === 2000 ? "two thousand" : `two thousand and ${ONES[year - 2000]}`;
  if (year < 1000 || year % 1000 === 0) return cardinal(year);
  const hi = Math.floor(year / 100);
  const lo = year % 100;
  if (lo === 0) return `${underHundred(hi)} hundred`;
  return `${underHundred(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : underHundred(lo)}`;
}

const ORDINAL_IRREGULAR: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth",
};

export function ordinalWords(n: number): string {
  const words = cardinal(n).split(" ");
  const last = words.pop() as string;
  const [head, tail] = last.includes("-") ? [last.slice(0, last.lastIndexOf("-") + 1), last.slice(last.lastIndexOf("-") + 1)] : ["", last];
  const ord = ORDINAL_IRREGULAR[tail] ?? (tail.endsWith("y") ? `${tail.slice(0, -1)}ieth` : `${tail}th`);
  return [...words, head + ord].join(" ");
}

/** A plain decimal: "9.006" -> "nine point zero zero six". */
function decimalWords(text: string): string {
  const [whole, frac] = text.split(".");
  const w = cardinal(Number(whole.replace(/,/g, "")));
  return frac ? `${w} point ${[...frac].map((d) => ONES[Number(d)]).join(" ")}` : w;
}

/** A bare number written in the script: 4 digits with no comma is read as a year. */
function numberWords(raw: string): string {
  if (/^\d{4}$/.test(raw) && Number(raw) >= 1000 && Number(raw) < 2100) return yearWords(Number(raw));
  return decimalWords(raw);
}

const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const LEAD = /^([("'“‘]*)/;
const TRAIL = /([)"'”’.,;:!?]*)$/;

/**
 * Spoken form of one written token, or null when it needs no change. `next` is the following
 * token, so "$2" before "billion" can move "dollars" after the scale word.
 */
function spellToken(token: string, next: string | undefined, dictionary: Readonly<Record<string, string>>): { spoken: string; dollarsAfterNext: boolean } | null {
  const lead = token.match(LEAD)?.[1] ?? "";
  const trail = token.slice(lead.length).match(TRAIL)?.[1] ?? "";
  const core = token.slice(lead.length, token.length - trail.length);
  const wrap = (s: string) => `${lead}${s}${trail}`;

  const dict = dictionary[core];
  if (dict) return { spoken: wrap(dict), dollarsAfterNext: false };

  let m = core.match(new RegExp(`^\\$(${NUMBER})$`));
  if (m) {
    const nextWord = next?.toLowerCase().replace(/[^a-z]/g, "");
    if (nextWord && SCALE_WORDS.has(nextWord)) return { spoken: wrap(decimalWords(m[1])), dollarsAfterNext: true };
    const value = Number(m[1].replace(/,/g, ""));
    return { spoken: wrap(`${decimalWords(m[1])} ${value === 1 ? "dollar" : "dollars"}`), dollarsAfterNext: false };
  }
  m = core.match(new RegExp(`^(${NUMBER})%$`));
  if (m) return { spoken: wrap(`${decimalWords(m[1])} percent`), dollarsAfterNext: false };
  m = core.match(/^(\d{3,4})s$/);
  if (m) {
    const words = numberWords(m[1]).split(" ");
    const last = words.pop() as string;
    const plural = last.endsWith("y") ? `${last.slice(0, -1)}ies` : `${last}s`;
    return { spoken: wrap([...words, plural].join(" ")), dollarsAfterNext: false };
  }
  m = core.match(/^(\d+)(st|nd|rd|th)$/);
  if (m) return { spoken: wrap(ordinalWords(Number(m[1]))), dollarsAfterNext: false };
  m = core.match(new RegExp(`^(${NUMBER})$`));
  if (m) return { spoken: wrap(numberWords(m[1])), dollarsAfterNext: false };
  return null;
}

export type SpokenGroup = { written: string; spoken: string };
export type Spelled = { spoken: string; groups: SpokenGroup[] };

/** Spoken form of a narration, with each written token's spoken words. */
export function spellNarration(narration: string, dictionary: Readonly<Record<string, string>> = {}): Spelled {
  const tokens = narration.split(/\s+/).filter(Boolean);
  const groups: SpokenGroup[] = [];
  let dollarsPending = false;
  tokens.forEach((token, i) => {
    const spelled = spellToken(token, tokens[i + 1], dictionary);
    let spoken = spelled?.spoken ?? token;
    if (dollarsPending) {
      const trail = token.match(TRAIL)?.[1] ?? "";
      spoken = `${spoken.slice(0, spoken.length - trail.length)} dollars${trail}`;
      dollarsPending = false;
    }
    dollarsPending = spelled?.dollarsAfterNext ?? false;
    groups.push({ written: token, spoken });
  });
  return { spoken: groups.map((g) => g.spoken).join(" "), groups };
}

/** Folds timings of the spoken words back onto the written tokens: each token spans its spoken words. */
export function foldTimings(spelled: Spelled, spokenWords: readonly WordTiming[]): WordTiming[] {
  const counts = spelled.groups.map((g) => g.spoken.split(/\s+/).filter(Boolean).length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== spokenWords.length) {
    throw new Error(`Speller produced ${total} spoken words but the voice timed ${spokenWords.length}`);
  }
  let cursor = 0;
  return spelled.groups.map((group, i) => {
    const words = spokenWords.slice(cursor, cursor + counts[i]);
    cursor += counts[i];
    return { text: group.written, startMs: words[0].startMs, endMs: words[words.length - 1].endMs };
  });
}
