/**
 * Figures in text: every number a narration says, written as digits ("1494", "$1,000", "8%") or
 * spelled out ("fourteen ninety-four", "a thousand", "nine point zero zero six"). Used to trace
 * spoken numbers and years to facts.
 */

export type Figure = { text: string; value: number };

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALE: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
const DIGIT_TOKEN = /^\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?:%|s|st|nd|rd|th)?$/;

type Atom =
  | { kind: "small"; value: number; text: string }
  | { kind: "hundred" | "scale" | "and" | "point" | "oh" | "a"; value: number; text: string };

/** One word (already lowercased, no punctuation) as number atoms, or null when it is not a number word. */
function atomsOf(word: string): Atom[] | null {
  if (word in SMALL) return [{ kind: "small", value: SMALL[word], text: word }];
  if (word === "hundred") return [{ kind: "hundred", value: 100, text: word }];
  if (word in SCALE) return [{ kind: "scale", value: SCALE[word], text: word }];
  if (word === "and" || word === "point" || word === "oh" || word === "a") return [{ kind: word, value: 0, text: word }];
  const parts = word.split("-");
  if (parts.length === 2 && SMALL[parts[0]] >= 20 && SMALL[parts[0]] % 10 === 0 && SMALL[parts[1]] >= 1 && SMALL[parts[1]] <= 9) {
    return [{ kind: "small", value: SMALL[parts[0]] + SMALL[parts[1]], text: word }];
  }
  return null;
}

/** Reads the spelled-out figures in one run of number atoms. */
function readRun(atoms: Atom[]): Figure[] {
  const out: Figure[] = [];
  let i = 0;
  const at = (k: number) => atoms[k];
  const isSmall = (k: number) => at(k)?.kind === "small";
  const under100 = (): number | null => {
    if (!isSmall(i)) return null;
    let v = at(i).value;
    i += 1;
    if (v >= 20 && v % 10 === 0 && isSmall(i) && at(i).value >= 1 && at(i).value <= 9) {
      v += at(i).value;
      i += 1;
    }
    return v;
  };
  while (i < atoms.length) {
    const start = i;
    const a = at(i);
    // Year forms: "fourteen ninety-four", "nineteen oh five", "twenty twenty-five".
    if (a.kind === "small" && a.value >= 10) {
      const save = i;
      const hi = under100();
      if (hi !== null && hi >= 10 && hi <= 99) {
        if (isSmall(i) && at(i).value >= 10) {
          const lo = under100() as number;
          out.push({ text: atoms.slice(start, i).map((x) => x.text).join(" "), value: hi * 100 + lo });
          continue;
        }
        if (at(i)?.kind === "oh" && isSmall(i + 1) && at(i + 1).value <= 9) {
          out.push({ text: atoms.slice(start, i + 2).map((x) => x.text).join(" "), value: hi * 100 + at(i + 1).value });
          i += 2;
          continue;
        }
      }
      i = save;
    }
    // Cardinals: "a thousand", "seven thousand nine hundred and eighty-eight", "nineteen hundred".
    let total = 0;
    let read = false;
    for (;;) {
      let chunk: number | null;
      if (at(i)?.kind === "a" && (at(i + 1)?.kind === "hundred" || at(i + 1)?.kind === "scale")) {
        chunk = 1;
        i += 1;
      } else {
        chunk = under100();
      }
      if (chunk === null) break;
      read = true;
      if (at(i)?.kind === "hundred") {
        chunk *= 100;
        i += 1;
        if (at(i)?.kind === "and" && isSmall(i + 1)) i += 1;
        chunk += under100() ?? 0;
      }
      if (at(i)?.kind === "scale") {
        total += chunk * at(i).value;
        i += 1;
        if (at(i)?.kind === "and" && isSmall(i + 1)) i += 1;
        continue;
      }
      total += chunk;
      break;
    }
    if (!read) {
      i = start + 1;
      continue;
    }
    if (at(i)?.kind === "point" && isSmall(i + 1) && at(i + 1).value <= 9) {
      let digits = "";
      i += 1;
      while (isSmall(i) && at(i).value <= 9) {
        digits += String(at(i).value);
        i += 1;
      }
      total = Number(`${total}.${digits}`);
    }
    out.push({ text: atoms.slice(start, i).map((x) => x.text).join(" "), value: total });
  }
  return out;
}

/** Every figure in a text, in order. A lone "one" is left out: it is usually a pronoun, not a figure. */
export function figuresIn(text: string): Figure[] {
  const out: Figure[] = [];
  let run: Atom[] = [];
  const flush = () => {
    out.push(...readRun(run));
    run = [];
  };
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const token = raw.replace(/^[("'“‘]+/, "");
    const word = token.replace(/[)"'”’.,;:!?]+$/, "");
    const endsClause = word.length < token.length;
    const digits = word.match(DIGIT_TOKEN);
    if (digits) {
      flush();
      out.push({ text: word, value: Number(digits[1].replace(/,/g, "")) });
    } else {
      const atoms = atomsOf(word.toLowerCase());
      if (atoms) run.push(...atoms);
      else flush();
    }
    if (endsClause) flush();
  }
  flush();
  return out.filter((f) => !(f.text.toLowerCase() === "one" && f.value === 1));
}

function roundSig(n: number, sig: number): number {
  if (n === 0) return 0;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(n))) - sig + 1);
  return Math.round(n / p) * p;
}

/** A spoken figure matches a fact number exactly, or as that number rounded to one or two significant figures ("about two thousand" for 1,999). */
export function figureMatches(spoken: number, factNumber: number): boolean {
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if (close(spoken, factNumber)) return true;
  return spoken !== 0 && [1, 2].some((sig) => close(spoken, roundSig(factNumber, sig)));
}
