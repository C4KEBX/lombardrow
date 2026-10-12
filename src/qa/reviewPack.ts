/**
 * The review pack: what the viral reviewer sees of a finished video, made from the video file alone. Frames
 * (dense over the first 5 s, where viewers decide), the words as heard with their times, and measured facts
 * (cuts, loudness, silences). It carries none of the brand's rules, so the reviewer judges like a fresh viewer.
 */

/** Frame times: every 0.25 s for the first 5 s, then every 2 s to the end. */
export function reviewFrameTimes(durationS: number): number[] {
  const times: number[] = [];
  for (let t = 0; t < Math.min(5, durationS); t += 0.25) times.push(Math.round(t * 100) / 100);
  for (let t = 6; t < durationS; t += 2) times.push(t);
  return times;
}

export const frameName = (t: number): string => `t-${t.toFixed(2).padStart(6, "0")}s.jpg`;

/** Scene-cut times from ffmpeg's `select='gt(scene,X)',showinfo` stderr. */
export function parseSceneCuts(stderr: string): number[] {
  const out: number[] = [];
  for (const m of stderr.matchAll(/pts_time:([\d.]+)/g)) out.push(Number(m[1]));
  return out;
}

/** Silent stretches from ffmpeg's `silencedetect` stderr. */
export function parseSilences(stderr: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let start: number | undefined;
  for (const line of stderr.split("\n")) {
    const s = /silence_start: ([\d.]+)/.exec(line);
    if (s) start = Number(s[1]);
    const e = /silence_end: ([\d.]+)/.exec(line);
    if (e && start !== undefined) {
      out.push({ start, end: Number(e[1]) });
      start = undefined;
    }
  }
  return out;
}

export type ReviewFacts = {
  durationS: number;
  width: number;
  height: number;
  loudnessLufs: number;
  cuts: number[];
  silences: { start: number; end: number }[];
  words: { text: string; startMs: number }[];
  frames: number[];
};

/** Narration as heard, in lines of about 2 s, each with its start time. */
export function transcriptLines(words: readonly { text: string; startMs: number }[], spanMs = 2000): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  let lineStart = 0;
  for (const w of words) {
    if (current.length > 0 && w.startMs - lineStart >= spanMs) {
      lines.push(`${(lineStart / 1000).toFixed(1)} s: ${current.join(" ")}`);
      current = [];
    }
    if (current.length === 0) lineStart = w.startMs;
    current.push(w.text);
  }
  if (current.length > 0) lines.push(`${(lineStart / 1000).toFixed(1)} s: ${current.join(" ")}`);
  return lines;
}

export function renderReviewPack(f: ReviewFacts): string {
  const first = f.cuts[0];
  const perMinute = (f.cuts.length / f.durationS) * 60;
  return [
    "# Review pack",
    "",
    "Everything here is measured from the video file. `final.mp4` is the video itself. `frames/` holds stills, every 0.25 s for the first 5 s and every 2 s after, named by time. `contact.jpg` shows them all on one sheet.",
    "",
    "## Measured",
    "",
    `- Length ${f.durationS.toFixed(1)} s, ${f.width}x${f.height}, loudness ${f.loudnessLufs.toFixed(1)} LUFS.`,
    `- Hard cuts detected: ${f.cuts.length} (${perMinute.toFixed(1)} a minute), first at ${first === undefined ? "none" : `${first.toFixed(1)} s`}. Cuts at: ${f.cuts.map((c) => c.toFixed(1)).join(", ") || "none"}. Motion inside a shot (zooms, text writing on) does not count as a cut.`,
    `- Silences of 0.3 s or more below -45 dB: ${f.silences.length}${f.silences.length ? ` (${f.silences.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)} s`).join(", ")})` : ""}.`,
    "",
    "## Narration as heard",
    "",
    ...transcriptLines(f.words).map((l) => `- ${l}`),
    "",
  ].join("\n");
}
