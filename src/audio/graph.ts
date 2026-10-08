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

export type GraphOptions = {
  clipStartsMs: readonly number[];
  hasMusic: boolean;
  totalSeconds: number;
  musicVolume?: number;
  measure?: LoudnormMeasure;
};

/** Filter graph: clips delayed to scene starts -> (ducked music) -> padded to length -> loudnorm. */
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
  if (o.hasMusic) {
    parts.push(
      "[narrP]asplit=2[narrA][narrB]",
      `[${n}:a]${FORMAT},volume=${o.musicVolume ?? 0.35}[music]`,
      "[music][narrA]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350:makeup=1[ducked]",
      "[narrB][ducked]amix=inputs=2:normalize=0:duration=longest[mix0]",
    );
  } else {
    parts.push("[narrP]anull[mix0]");
  }
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
