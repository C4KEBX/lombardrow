/**
 * loudnorm targets. TP is set below the -1.5 dBTP ceiling because resampling to 44.1 kHz and the
 * AAC encode add about 0.1 dB of true-peak overshoot after loudnorm has limited the signal.
 */
export const TARGET = { I: -14, TP: -2, LRA: 11 } as const;

/** What the finished file must satisfy. */
export const LOUDNESS_LIMITS = { toleranceLu: 1, maxTruePeak: -1.5 } as const;

/** Audio quieter than this cannot be meaningfully normalized and is treated as silent. */
export const MIN_AUDIBLE_LUFS = -50;

export type LoudnormMeasure = {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
};

export function parseLoudnorm(stderr: string): LoudnormMeasure {
  const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!blocks) throw new Error("ffmpeg loudnorm printed no measurement");
  const raw = JSON.parse(blocks[blocks.length - 1]) as Record<string, string>;
  if (Number(raw.input_i) < MIN_AUDIBLE_LUFS) {
    throw new Error(`The audio is silent or near-silent (${raw.input_i} LUFS); cannot normalize loudness`);
  }
  const read = (key: string): number => {
    const value = Number(raw[key]);
    if (!Number.isFinite(value)) {
      throw new Error(`The audio is silent or unmeasurable (loudnorm ${key} = ${raw[key]}); cannot normalize loudness`);
    }
    return value;
  };
  return {
    inputI: read("input_i"),
    inputTp: read("input_tp"),
    inputLra: read("input_lra"),
    inputThresh: read("input_thresh"),
    targetOffset: read("target_offset"),
  };
}

export function assertLoudnessOk(measure: LoudnormMeasure): void {
  const offTarget = Math.abs(measure.inputI - TARGET.I) > LOUDNESS_LIMITS.toleranceLu;
  const tooHot = measure.inputTp > LOUDNESS_LIMITS.maxTruePeak;
  if (offTarget || tooHot) {
    throw new Error(
      `Final audio is ${measure.inputI} LUFS / ${measure.inputTp} dBTP; required ${TARGET.I} +/- ${LOUDNESS_LIMITS.toleranceLu} LUFS and at most ${LOUDNESS_LIMITS.maxTruePeak} dBTP`,
    );
  }
}

const FORMAT = "aformat=sample_rates=44100:channel_layouts=stereo";

/** A library bed sits this far below its normalized loudness before ducking: resting about 8 dB under Edge narration. */
export const MUSIC_BED_DB = -7;
/** The generated ambient drone's level (it is not loudness-normalized like the library beds). */
export const AMBIENT_DB = -9;
/** Gentle ducking: about 4 dB under speech, back up within half a second of a pause. */
export const DUCK = "threshold=0.05:ratio=4:attack=20:release=500:makeup=1";
/** Bed fades: in quickly so the hook has music under it, out over the door plate. */
export const MUSIC_FADE = { in: 0.4, out: 1.5 } as const;

export type GraphSfx = {
  /** Number of distinct sound files, as inputs after the clips and the music. */
  files: number;
  cues: readonly { file: number; atMs: number; gainDb: number }[];
};

export type GraphOptions = {
  clipStartsMs: readonly number[];
  hasMusic: boolean;
  totalSeconds: number;
  musicGainDb?: number;
  sfx?: GraphSfx;
  measure?: LoudnormMeasure;
};

const db = (value: number) => `${Number(value.toFixed(2))}dB`;

/** One labelled stream per cue: each file split as many times as it is used, then level and delay. */
function sfxParts(sfx: GraphSfx, firstInput: number): string[] {
  const parts: string[] = [];
  const uses = Array.from({ length: sfx.files }, (_, k) => sfx.cues.map((c, i) => ({ c, i })).filter(({ c }) => c.file === k));
  uses.forEach((list, k) => {
    if (list.length === 0) return;
    const outs = list.map(({ i }) => `[s${i}]`).join("");
    parts.push(`[${firstInput + k}:a]${FORMAT},${list.length === 1 ? "anull" : `asplit=${list.length}`}${outs}`);
  });
  sfx.cues.forEach((c, i) => {
    const delay = Math.max(0, Math.round(c.atMs));
    parts.push(`[s${i}]volume=${db(c.gainDb)},adelay=${delay}|${delay}[c${i}]`);
  });
  const all = sfx.cues.map((_, i) => `[c${i}]`).join("");
  parts.push(sfx.cues.length === 1 ? `${all}anull[sfx]` : `${all}amix=inputs=${sfx.cues.length}:normalize=0:duration=longest[sfx]`);
  return parts;
}

/** Filter graph: clips delayed to scene starts -> (ducked, faded music) -> (sound effects) -> padded to length -> loudnorm. */
export function buildAudioGraph(o: GraphOptions): string {
  const n = o.clipStartsMs.length;
  if (n === 0) throw new RangeError("buildAudioGraph needs at least one narration clip");
  const parts: string[] = o.clipStartsMs.map((ms, i) => {
    const delay = Math.round(ms);
    return `[${i}:a]adelay=${delay}|${delay},${FORMAT}[n${i}]`;
  });
  parts.push(
    n === 1
      ? "[n0]anull[narr]"
      : `${o.clipStartsMs.map((_, i) => `[n${i}]`).join("")}amix=inputs=${n}:normalize=0:duration=longest[narr]`,
  );
  // Pad the narration to full length first: sidechaincompress stops when its sidechain input ends,
  // which would otherwise cut the music off as soon as the last clip finishes.
  parts.push(`[narr]apad=whole_dur=${o.totalSeconds}[narrP]`);
  const stems = [o.hasMusic ? "[narrB]" : "[narrP]"];
  if (o.hasMusic) {
    const T = o.totalSeconds;
    const fadeOut = Math.max(0, T - MUSIC_FADE.out);
    parts.push(
      "[narrP]asplit=2[narrA][narrB]",
      `[${n}:a]${FORMAT},atrim=0:${T},afade=t=in:d=${MUSIC_FADE.in},afade=t=out:st=${Number(fadeOut.toFixed(3))}:d=${MUSIC_FADE.out},volume=${db(o.musicGainDb ?? AMBIENT_DB)}[music]`,
      `[music][narrA]sidechaincompress=${DUCK}[ducked]`,
    );
    stems.push("[ducked]");
  }
  if (o.sfx && o.sfx.cues.length > 0) {
    parts.push(...sfxParts(o.sfx, n + (o.hasMusic ? 1 : 0)));
    stems.push("[sfx]");
  }
  parts.push(stems.length === 1 ? `${stems[0]}anull[mix0]` : `${stems.join("")}amix=inputs=${stems.length}:normalize=0:duration=longest[mix0]`);
  parts.push(`[mix0]apad=whole_dur=${o.totalSeconds}[mix]`);
  const base = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const m = o.measure;
  parts.push(
    m
      ? `[mix]${base}:measured_I=${m.inputI}:measured_TP=${m.inputTp}:measured_LRA=${m.inputLra}:measured_thresh=${m.inputThresh}:offset=${m.targetOffset}:linear=true:print_format=summary[out]`
      : `[mix]${base}:print_format=json[out]`,
  );
  return parts.join(";");
}
