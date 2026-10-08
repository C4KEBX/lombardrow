import { figuresIn } from "../schema/figures";
import { PRONUNCIATIONS } from "../voice/pronunciations";
import { spellNarration } from "../voice/speller";

/** A word whisper.cpp heard, with its time in the video. */
export type HeardWord = { text: string; startMs: number; endMs: number };
/** A word the script says, with the time its caption shows (undefined for the uncaptioned sign-off). */
type ExpectedWord = { word: string; written: string; captionMs?: number; sceneId: string; first: boolean };

export type Mismatch = { sceneId: string; atMs?: number; expected: string; heard: string; number: boolean };
export type Drift = { sceneId: string; word: string; captionMs: number; heardMs: number };
export type ListenBackReport = { words: number; heard: number; mismatches: Mismatch[]; drift: Drift[] };

/** Captions more than this far from the voice read as out of sync. */
export const DRIFT_MS = 300;

/** Spoken words in comparison form: numbers spelled out as the voice says them, lowercase, hyphens split. */
export function spokenWords(text: string): string[] {
  return spellNarration(text, PRONUNCIATIONS)
    .spoken.toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}']/gu, "").replace(/'s$/, "s"))
    .filter(Boolean);
}

const toMs = (stamp: string): number => {
  const m = stamp.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!m) throw new Error(`whisper timestamp "${stamp}" is not hh:mm:ss,mmm`);
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]);
};

/** Words from whisper.cpp's `-oj` JSON (run with `-ml 1 -sow` so each segment is one word). */
export function parseWhisperJson(json: unknown): HeardWord[] {
  const segments = (json as { transcription?: unknown }).transcription;
  if (!Array.isArray(segments)) throw new Error("whisper JSON has no transcription array");
  return segments.flatMap((seg: { text?: string; offsets?: { from: number; to: number }; timestamps?: { from: string; to: string } }) => {
    const text = (seg.text ?? "").trim();
    if (!text || /^\[.*\]$/.test(text)) return [];
    const startMs = seg.offsets?.from ?? toMs(seg.timestamps?.from ?? "");
    const endMs = seg.offsets?.to ?? toMs(seg.timestamps?.to ?? "");
    return [{ text, startMs, endMs }];
  });
}

/** Expected words in order: each scene's narration (timed by its captions), then the sign-off. */
export function expectedWords(
  scenes: readonly { id: string; narration: string }[],
  captions: readonly { text: string; startMs: number }[],
  signoff: string,
): ExpectedWord[] {
  const out: ExpectedWord[] = [];
  let caption = 0;
  for (const scene of scenes) {
    for (const group of spellNarration(scene.narration, PRONUNCIATIONS).groups) {
      const timed = captions[caption];
      caption += 1;
      spokenWords(group.spoken).forEach((word, k) => out.push({ word, written: group.written, captionMs: timed?.startMs, sceneId: scene.id, first: k === 0 }));
    }
  }
  for (const word of spokenWords(signoff)) out.push({ word, written: word, sceneId: "door", first: true });
  return out;
}

type Op = { kind: "same" | "sub" | "del" | "ins"; e?: number; h?: number };

/** Word-level edit script between what the script says and what was heard. */
function align(expected: readonly string[], heard: readonly string[]): Op[] {
  const n = expected.length;
  const m = heard.length;
  const cost: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      cost[i][j] = Math.min(cost[i - 1][j - 1] + (expected[i - 1] === heard[j - 1] ? 0 : 1), cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (expected[i - 1] === heard[j - 1] ? 0 : 1)) {
      ops.push({ kind: expected[i - 1] === heard[j - 1] ? "same" : "sub", e: i - 1, h: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      ops.push({ kind: "del", e: i - 1 });
      i -= 1;
    } else {
      ops.push({ kind: "ins", h: j - 1 });
      j -= 1;
    }
  }
  return ops.reverse();
}

/** Compares the transcript of final.mp4 with the script: wrong or missing words (numbers marked) and captions out of sync. */
export function listenBack(expected: readonly ExpectedWord[], heardWords: readonly HeardWord[]): ListenBackReport {
  const heard = heardWords.flatMap((w) => spokenWords(w.text).map((word) => ({ word, startMs: w.startMs })));
  const ops = align(expected.map((e) => e.word), heard.map((h) => h.word));
  const mismatches: Mismatch[] = [];
  const drift: Drift[] = [];
  let run: Op[] = [];
  let nextE = 0;
  const flush = () => {
    if (!run.length) return;
    const es = run.flatMap((o) => (o.e === undefined ? [] : [expected[o.e]]));
    const hs = run.flatMap((o) => (o.h === undefined ? [] : [heard[o.h]]));
    const anchor = es[0] ?? expected[Math.min(expected.length - 1, nextE)];
    const written = [...new Set(es.map((e) => e.written))].join(" ");
    mismatches.push({
      sceneId: anchor?.sceneId ?? "?",
      atMs: hs[0]?.startMs ?? es[0]?.captionMs,
      expected: es.map((e) => e.word).join(" "),
      heard: hs.map((h) => h.word).join(" "),
      number: figuresIn(written).length > 0 || figuresIn(es.map((e) => e.word).join(" ")).length > 0,
    });
    run = [];
  };
  for (const op of ops) {
    if (op.kind === "same") {
      flush();
      nextE = (op.e as number) + 1;
      const e = expected[op.e as number];
      const h = heard[op.h as number];
      // Only the first spoken word of each caption word carries the caption's time.
      if (e.captionMs !== undefined && e.first && Math.abs(h.startMs - e.captionMs) > DRIFT_MS) {
        drift.push({ sceneId: e.sceneId, word: e.written, captionMs: Math.round(e.captionMs), heardMs: Math.round(h.startMs) });
      }
    } else {
      run.push(op);
    }
  }
  flush();
  return { words: expected.length, heard: heard.length, mismatches, drift };
}

const clock = (ms?: number): string => (ms === undefined ? "--:--" : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`);

export function renderListenBack(report: ListenBackReport): string {
  const lines = [
    "# Listen-back",
    "",
    `whisper.cpp heard ${report.heard} words; the script has ${report.words}. Speech recognition makes its own mistakes, so treat each line as a place to listen closely, not a verdict.`,
    "",
    `## Words that differ (${report.mismatches.length})`,
    "",
    ...(report.mismatches.length
      ? report.mismatches.map((m) => `- ${clock(m.atMs)} ${m.sceneId}${m.number ? " **number**" : ""}: script "${m.expected || "(nothing)"}", heard "${m.heard || "(nothing)"}"`)
      : ["None."]),
    "",
    `## Captions out of sync by more than ${DRIFT_MS} ms (${report.drift.length})`,
    "",
    ...(report.drift.length
      ? report.drift.map((d) => `- ${d.sceneId} "${d.word}": caption at ${clock(d.captionMs)}, heard at ${clock(d.heardMs)}`)
      : ["None."]),
    "",
  ];
  return lines.join("\n");
}
