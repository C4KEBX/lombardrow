import { z } from "zod";
import { figuresIn } from "../schema/figures";
import type { Storyboard } from "../schema/storyboard";

/**
 * The variation kit: every video declares a plan before scripting, and the plan is checked against
 * recent videos so no two neighbours feel the same. Limits live in variation/variation_spec.json.
 */

const Window = z.strictObject({ count: z.number().int().min(1), window: z.number().int().min(1) });
const Dimension = z.strictObject({
  options: z.array(z.string().min(1)).min(1),
  maxRun: z.number().int().min(1).optional(),
  notSameAsPrevious: z.boolean().optional(),
  maxInWindow: Window.optional(),
  share: z
    .strictObject({
      targets: z.record(z.string(), z.number().min(0).max(1)),
      toleranceFraction: z.number().min(0).max(1),
      window: z.number().int().min(1),
      enforceFromVideo: z.number().int().min(1),
    })
    .optional(),
});

export const DIMENSIONS = ["pillar", "storyShape", "hookType", "era", "region", "primaryVisual", "paletteLead"] as const;
export type DimensionName = (typeof DIMENSIONS)[number];

export const SpecSchema = z.object({
  dimensions: z.strictObject(Object.fromEntries(DIMENSIONS.map((d) => [d, Dimension])) as Record<DimensionName, typeof Dimension>),
  visualMetaphor: z.object({ maxSharedWordsFraction: z.number().min(0).max(1), window: z.number().int().min(1) }),
  musicBed: z.object({ notInLast: z.number().int().min(0) }),
  title: z.object({ firstWords: z.number().int().min(1), window: z.number().int().min(1) }),
  script: z.object({
    minWords: z.number().int().min(1),
    maxWords: z.number().int().min(1),
    ngram: z.number().int().min(1),
    maxOverlapFraction: z.number().min(0).max(1),
    window: z.number().int().min(1),
  }),
  sources: z.object({ minSites: z.number().int().min(1) }),
  series: z.record(z.string(), z.string().min(1)),
});
export type Spec = z.output<typeof SpecSchema>;

export const PlanSchema = z.strictObject({
  doorNo: z.number().int().min(1).max(999),
  pillar: z.string().min(1),
  storyShape: z.string().min(1),
  hookType: z.string().min(1),
  era: z.string().min(1),
  region: z.string().min(1),
  primaryVisual: z.string().min(1),
  /** One concrete image invented for this topic. */
  visualMetaphor: z.string().min(1),
  paletteLead: z.string().min(1),
  /** Library track id, or null for no music. */
  musicBed: z.string().min(1).nullable(),
  title: z.string().min(1),
  /** What this video says that a generic explainer would not. */
  angle: z.string().min(1),
  sources: z.array(z.url()).min(1),
  /** The narration once written; the storyboard's narration is used when it is given. */
  script: z.string().optional(),
  /** Real length after produce, recorded in history. */
  durationSeconds: z.number().positive().optional(),
});
export type Plan = z.output<typeof PlanSchema>;
export type HistoryEntry = Plan & { publishedAt?: string };

export function parsePlan(input: unknown): Plan {
  const result = PlanSchema.safeParse(input);
  if (!result.success) throw new Error(`plan.json: ${z.prettifyError(result.error)}`);
  return result.data;
}

export function parseSpec(input: unknown): Spec {
  const result = SpecSchema.safeParse(input);
  if (!result.success) throw new Error(`variation_spec.json: ${z.prettifyError(result.error)}`);
  return result.data;
}

/** history.jsonl: one published plan per line, oldest first. */
export function parseHistory(text: string): HistoryEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        const { publishedAt, ...plan } = JSON.parse(line) as { publishedAt?: string };
        return { ...parsePlan(plan), publishedAt };
      } catch (error) {
        throw new Error(`history line ${i + 1}: ${(error as Error).message}`);
      }
    });
}

const STOPWORDS = new Set(
  "a an the of and or to in on at by for with from as is are was were be it its this that into over under".split(" "),
);
const contentWords = (text: string): Set<string> =>
  new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !STOPWORDS.has(w)));
const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

function ngrams(text: string, n: number): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i += 1) out.add(w.slice(i, i + n).join(" "));
  return out;
}

const firstWords = (title: string, n: number): string => words(title).slice(0, n).join(" ");

/** Reasons one dimension's value breaks the rules, given the history (oldest first). */
function dimensionReasons(name: DimensionName, value: string, history: readonly HistoryEntry[], spec: Spec): string[] {
  const d = spec.dimensions[name];
  const past = history.map((h) => h[name]);
  const reasons: string[] = [];
  if (!d.options.includes(value)) {
    return [`${name} "${value}" is not one of: ${d.options.join(", ")}`];
  }
  if (d.notSameAsPrevious && past.at(-1) === value) reasons.push(`${name} "${value}" is the same as the previous video`);
  if (d.maxRun) {
    const tail = past.slice(-d.maxRun);
    if (tail.length === d.maxRun && tail.every((v) => v === value)) {
      reasons.push(`${name} "${value}" would make ${d.maxRun + 1} in a row (max ${d.maxRun})`);
    }
  }
  if (d.maxInWindow) {
    const { count, window } = d.maxInWindow;
    const inWindow = [...past.slice(-(window - 1)), value].filter((v) => v === value).length;
    if (inWindow > count) reasons.push(`${name} "${value}" would appear ${inWindow} times in the last ${window} (max ${count})`);
  }
  if (d.share && history.length + 1 >= d.share.enforceFromVideo) {
    const recent = [...past.slice(-(d.share.window - 1)), value];
    const target = d.share.targets[value] ?? 0;
    const share = recent.filter((v) => v === value).length / recent.length;
    if (share > target + d.share.toleranceFraction) {
      reasons.push(
        `${name} "${value}" would be ${Math.round(share * 100)}% of the last ${recent.length} videos (target ${Math.round(target * 100)}%, max ${Math.round((target + d.share.toleranceFraction) * 100)}%)`,
      );
    }
  }
  return reasons;
}

export type VariationReport = { ok: boolean; reasons: string[] };

/** Checks a plan against recent videos. With a storyboard, its narration is the script. */
export function checkPlan(plan: Plan, history: readonly HistoryEntry[], spec: Spec, script = plan.script): VariationReport {
  const reasons: string[] = DIMENSIONS.flatMap((d) => dimensionReasons(d, plan[d], history, spec));

  const metaphor = contentWords(plan.visualMetaphor);
  for (const past of history.slice(-spec.visualMetaphor.window)) {
    const shared = [...metaphor].filter((w) => contentWords(past.visualMetaphor).has(w));
    if (metaphor.size && shared.length / metaphor.size >= spec.visualMetaphor.maxSharedWordsFraction) {
      reasons.push(`visual metaphor shares ${shared.length} of ${metaphor.size} words with No. ${past.doorNo} ("${past.visualMetaphor}")`);
      break;
    }
  }
  if (plan.musicBed !== null) {
    const recent = history.slice(-spec.musicBed.notInLast).map((h) => h.musicBed);
    if (recent.includes(plan.musicBed)) reasons.push(`music bed "${plan.musicBed}" was used in the last ${spec.musicBed.notInLast} videos`);
  }
  const opening = firstWords(plan.title, spec.title.firstWords);
  const clash = history.slice(-spec.title.window).find((h) => firstWords(h.title, spec.title.firstWords) === opening);
  if (clash) reasons.push(`title starts "${opening}", like No. ${clash.doorNo} ("${clash.title}")`);

  const sites = new Set(plan.sources.map((u) => new URL(u).hostname.replace(/^www\./, "")));
  if (sites.size < spec.sources.minSites) reasons.push(`plan lists ${sites.size} source site${sites.size === 1 ? "" : "s"}; at least ${spec.sources.minSites} are needed`);
  if (!plan.angle.trim()) reasons.push("the angle is empty");

  if (script !== undefined) {
    const count = words(script).length;
    if (count < spec.script.minWords || count > spec.script.maxWords) {
      reasons.push(`script is ${count} words (${spec.script.minWords}-${spec.script.maxWords})`);
    }
    const mine = ngrams(script, spec.script.ngram);
    for (const past of history.slice(-spec.script.window)) {
      if (!past.script || mine.size === 0) continue;
      const theirs = ngrams(past.script, spec.script.ngram);
      const overlap = [...mine].filter((g) => theirs.has(g)).length / mine.size;
      if (overlap >= spec.script.maxOverlapFraction) {
        reasons.push(`script shares ${Math.round(overlap * 100)}% of its ${spec.script.ngram}-word phrases with No. ${past.doorNo} (max ${Math.round(spec.script.maxOverlapFraction * 100)}%)`);
      }
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/** For each dimension, the options the next video may use, least recently used first (never used first, in spec order). */
export function suggest(history: readonly HistoryEntry[], spec: Spec): Record<DimensionName, string[]> {
  const out = {} as Record<DimensionName, string[]>;
  for (const name of DIMENSIONS) {
    const lastUsed = (option: string) => {
      for (let i = history.length - 1; i >= 0; i -= 1) if (history[i][name] === option) return i;
      return -1;
    };
    out[name] = spec.dimensions[name].options
      .filter((option) => dimensionReasons(name, option, history, spec).length === 0)
      .map((option, order) => ({ option, last: lastUsed(option), order }))
      .sort((a, b) => a.last - b.last || a.order - b.order)
      .map((x) => x.option);
  }
  return out;
}

/** Scene types that render each primary visual today. Empty means the scene type is not built yet (Phase 5). */
export const VISUAL_SCENES: Record<string, readonly string[]> = {
  line_chart: ["line-chart"],
  bar_chart: ["bar-race"],
  timeline: ["timeline"],
  map: ["map"],
  scale_comparison: ["compare"],
  split_screen: ["compare"],
  flow_diagram: ["flow-diagram"],
  // An archival scan of a coin, note or page, pushed in close.
  object_close_up: ["archival"],
  ledger_page: ["ledger-page"],
  character_scene: [],
};

const firstSentence = (text: string): string => text.split(/(?<=[.!?])\s+/)[0] ?? "";

/** The plan must describe the video the storyboard actually renders. */
export function crossCheck(plan: Plan, sb: Storyboard, spec: Spec): string[] {
  const reasons: string[] = [];
  if (plan.doorNo !== sb.meta.doorNo) reasons.push(`plan door No. ${plan.doorNo} but storyboard meta.doorNo is ${sb.meta.doorNo}`);
  if (plan.musicBed !== sb.audio.music) reasons.push(`plan music bed ${JSON.stringify(plan.musicBed)} but storyboard audio.music is ${JSON.stringify(sb.audio.music)}`);
  if (plan.paletteLead !== sb.meta.paletteLead) reasons.push(`plan palette lead "${plan.paletteLead}" but storyboard meta.paletteLead is "${sb.meta.paletteLead}"`);
  const series = spec.series[plan.pillar];
  if (series && series.toLowerCase() !== sb.meta.series.toLowerCase()) {
    reasons.push(`pillar "${plan.pillar}" is the series "${series}", but storyboard meta.series is "${sb.meta.series}"`);
  }
  const scenes = VISUAL_SCENES[plan.primaryVisual];
  if (scenes && scenes.length === 0) {
    reasons.push(`primary visual "${plan.primaryVisual}" has no scene type yet; pick one the library renders (${Object.entries(VISUAL_SCENES).filter(([, s]) => s.length).map(([v]) => v).join(", ")})`);
  } else if (scenes && !sb.scenes.some((s) => scenes.includes(s.type))) {
    reasons.push(`primary visual "${plan.primaryVisual}" needs a ${scenes.join(" or ")} scene, and the storyboard has none`);
  }
  const opener = firstSentence(sb.scenes[0]?.narration ?? "");
  if (plan.hookType === "question" && !opener.trim().endsWith("?")) {
    reasons.push(`hook "question" but the first sentence is not a question: "${opener}"`);
  }
  if (plan.hookType === "surprising_number" && figuresIn(opener).length === 0) {
    reasons.push(`hook "surprising_number" but the first sentence says no number: "${opener}"`);
  }
  if (plan.hookType === "date" && !figuresIn(opener).some((f) => f.value >= 1000 && f.value <= 2100) && !/\bBC\b/.test(opener)) {
    reasons.push(`hook "date" but the first sentence names no year: "${opener}"`);
  }
  return reasons;
}

/** The storyboard's narration as one script. */
export const scriptOf = (sb: Storyboard): string => sb.scenes.map((s) => s.narration).join(" ");
