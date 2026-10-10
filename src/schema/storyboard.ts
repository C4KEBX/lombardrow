import { z } from "zod";
import { GROUNDS } from "../design/theme";

export class StoryboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryboardError";
  }
}

export const TONES = ["positive", "negative", "neutral", "highlight"] as const;

export const CueSchema = z.strictObject({
  atWord: z.string().min(1),
  occurrence: z.number().int().min(1).default(1),
  do: z.enum(["callout", "emphasize"]),
  text: z.string().min(1).max(24).optional(),
  x: z.number().optional(),
}).refine((cue) => cue.text !== undefined, {
  message: "a callout or emphasize cue requires text",
  path: ["text"],
});

const sceneBase = {
  id: z.string().regex(/^[a-z0-9-]+$/, "scene id must be lowercase letters, digits, hyphens"),
  narration: z.string().min(1),
  cues: z.array(CueSchema).default([]),
  /** Overrides the video's palette lead for this scene. */
  ground: z.enum(GROUNDS).optional(),
  /** The year the story is in during this scene (negative is BC). Drives the year counter; omit for the present. */
  year: z.number().int().min(-5000).max(2100).optional(),
  /** A fact whose source stamps this scene when the scene has no factId of its own (e.g. a title naming a year). */
  sourceFactId: z.string().min(1).optional(),
  /** Facts behind the figures the narration speaks. Every number or year said aloud must match a fact the scene names. */
  speaks: z.array(z.string().min(1)).min(1).optional(),
  /** Voice this scene about 10% faster (the fast format's opening seconds). */
  brisk: z.boolean().optional(),
  /** Lines in this scene's narration that re-hook the viewer ("But that's not the first reason."), quoted exactly. */
  microhooks: z.array(z.string().min(1)).optional(),
};

const TitleSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("title"),
  props: z.strictObject({
    headline: z.string().min(1).max(80),
    kicker: z.string().min(1).max(40).optional(),
  }),
});

const BigNumberSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("big-number"),
  props: z.strictObject({
    value: z.number(),
    prefix: z.string().max(4).default(""),
    suffix: z.string().max(6).default(""),
    decimals: z.number().int().min(0).max(4).default(0),
    label: z.string().min(1).max(60),
    factId: z.string().min(1),
    tone: z.enum(TONES).default("highlight"),
  }),
});

const PointSchema = z.strictObject({ x: z.number(), y: z.number() });

const LineChartSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("line-chart"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      points: z.array(PointSchema).min(2).max(60),
      xFormat: z.enum(["year", "number"]).default("number"),
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(6).default(""),
      decimals: z.number().int().min(0).max(4).default(0),
      tone: z.enum(TONES).default("highlight"),
      baseline: z.enum(["zero", "data"]).default("zero"),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      props.points.forEach((point, i) => {
        if (i > 0 && point.x <= props.points[i - 1].x) {
          ctx.addIssue({
            code: "custom",
            path: ["points", i, "x"],
            message: "x values must be strictly increasing",
          });
        }
      });
    }),
});

const MAX_RACE_ENTITIES = 8; // more names than this cannot be read at once

const RaceFrameSchema = z
  .strictObject({
    label: z.string().min(1).max(12),
    values: z
      .array(z.strictObject({ name: z.string().min(1).max(18), value: z.number().min(0) }))
      .min(2)
      .max(12),
  })
  .superRefine((frame, ctx) => {
    const seen = new Set<string>();
    frame.values.forEach((v, i) => {
      if (seen.has(v.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["values", i, "name"],
          message: `duplicate name "${v.name}" in frame "${frame.label}"`,
        });
      }
      seen.add(v.name);
    });
  });

const BarRaceSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("bar-race"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      frames: z.array(RaceFrameSchema).min(2).max(20),
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(6).default(""),
      decimals: z.number().int().min(0).max(4).default(0),
      topN: z.number().int().min(3).max(8).default(5),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      const names = new Set(props.frames.flatMap((frame) => frame.values.map((v) => v.name)));
      if (names.size > MAX_RACE_ENTITIES) {
        ctx.addIssue({
          code: "custom",
          path: ["frames"],
          message: `a bar race supports at most ${MAX_RACE_ENTITIES} distinct names (one color each); got ${names.size}`,
        });
      }
      const seen = new Set<string>();
      props.frames.forEach((frame, i) => {
        if (seen.has(frame.label)) {
          ctx.addIssue({
            code: "custom",
            path: ["frames", i, "label"],
            message: `duplicate frame label "${frame.label}"`,
          });
        }
        seen.add(frame.label);
      });
    }),
});

const KineticTextSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("kinetic-text"),
  props: z.strictObject({
    lines: z.array(z.string().min(1).max(14)).min(1).max(4),
    tone: z.enum(TONES).default("highlight"),
  }),
});

const CompareSideSchema = z.strictObject({
  label: z.string().min(1).max(14),
  value: z.number().min(0),
  factId: z.string().min(1),
});

const CompareSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("compare"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      left: CompareSideSchema,
      right: CompareSideSchema,
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(6).default(""),
      decimals: z.number().int().min(0).max(4).default(0),
    })
    .superRefine((props, ctx) => {
      if (props.left.value <= 0 && props.right.value <= 0) {
        ctx.addIssue({ code: "custom", path: ["left", "value"], message: "at least one side must be greater than zero" });
      }
    }),
});

const QuoteSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("quote"),
  props: z.strictObject({
    quote: z.string().min(1).max(140),
    attribution: z.string().min(1).max(28),
    factId: z.string().min(1),
  }),
});

const TimelineEventSchema = z.strictObject({
  year: z.number().int().min(-3000).max(2100).refine((y) => y !== 0, "there is no year 0"),
  label: z.string().min(1).max(26),
});

const TimelineSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("timeline"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      events: z.array(TimelineEventSchema).min(2).max(6),
      tone: z.enum(TONES).default("highlight"),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      props.events.forEach((event, i) => {
        if (i > 0 && event.year <= props.events[i - 1].year) {
          ctx.addIssue({ code: "custom", path: ["events", i, "year"], message: "event years must be strictly increasing" });
        }
      });
    }),
});

const LonSchema = z.number().min(-180).max(180);
const LatSchema = z.number().min(-80).max(80); // matches the camera's Mercator clamp

const MapSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("map"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      regions: z.array(z.string().min(1).max(40)).min(1).max(6),
      focus: z.tuple([LonSchema, LatSchema, LonSchema, LatSchema]),
      tone: z.enum(TONES).default("highlight"),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      const [w, s, e, n] = props.focus;
      if (w >= e || s >= n) {
        ctx.addIssue({ code: "custom", path: ["focus"], message: "focus must be [west, south, east, north] with west < east and south < north" });
      }
      const seen = new Set<string>();
      props.regions.forEach((name, i) => {
        if (seen.has(name)) ctx.addIssue({ code: "custom", path: ["regions", i], message: `duplicate region "${name}"` });
        seen.add(name);
      });
    }),
});

/** A public-domain scan or painting from assets.json, with a slow pan and zoom. */
/** A rectangle on an image, as fractions of its width and height (0 to 1). */
const ImageRectSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});

/**
 * One crop of a bleed archival image. The crop is centred on (x, y), fractions of the image, and is `w` of the
 * image's width across the frame: 0.6 shows a line of type at about phone-reading size on a full page scan.
 */
const ShotSchema = z.strictObject({
  atWord: z.string().min(1).optional(),
  occurrence: z.number().int().min(1).default(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.05).max(1),
  /** A highlighter swept across these words, as they are spoken. */
  mark: ImageRectSchema.optional(),
});

const ArchivalSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("archival"),
  props: z.strictObject({
    /** What the image shows, as a short header ("Pacioli's Summa, Venice"). */
    title: z.string().min(1).max(32),
    assetId: z.string().min(1),
    /** Where the camera starts and ends, as fractions of the image (0 to 1), and the zoom at each end. */
    from: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.number().min(1).max(2.5) }).default({ x: 0.5, y: 0.5, zoom: 1 }),
    to: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.number().min(1).max(2.5) }).default({ x: 0.5, y: 0.5, zoom: 1.15 }),
    /** "framed": the image in a Brass frame under its title. "bleed": the image fills the whole 9:16 frame, shot by shot. */
    layout: z.enum(["framed", "bleed"]).default("framed"),
    /** For a bleed layout: the crops the scene cuts between, each pushing in slowly, the first from frame 0. */
    shots: z.array(ShotSchema).max(8).optional(),
  }).superRefine((props, ctx) => {
    if (props.layout === "bleed" && !props.shots?.length) ctx.addIssue({ code: "custom", path: ["shots"], message: "a bleed archival scene needs at least one shot" });
    if (props.layout === "framed" && props.shots) ctx.addIssue({ code: "custom", path: ["shots"], message: "shots are for the bleed layout; a framed scene pans with from and to" });
    props.shots?.forEach((shot, i) => {
      if (i === 0 && shot.atWord) ctx.addIssue({ code: "custom", path: ["shots", 0, "atWord"], message: "the first shot starts the scene; leave out its atWord" });
      if (i > 0 && !shot.atWord) ctx.addIssue({ code: "custom", path: ["shots", i, "atWord"], message: "every shot after the first cuts in on a spoken word: give its atWord" });
    });
  }),
});

/** One sum of money traced step by step: boxes top to bottom, a token travelling down as each step is spoken. */
const FlowStepSchema = z.strictObject({
  label: z.string().min(1).max(22),
  note: z.string().min(1).max(28).optional(),
});
const FlowDiagramSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("flow-diagram"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      steps: z.array(FlowStepSchema).min(2).max(5),
      /** Text on each arrow between steps (one fewer than steps), e.g. the amount that moves. */
      arrows: z.array(z.string().min(1).max(16)).optional(),
      tone: z.enum(TONES).default("highlight"),
      factId: z.string().min(1).optional(),
    })
    .superRefine((props, ctx) => {
      if (props.arrows && props.arrows.length !== props.steps.length - 1) {
        ctx.addIssue({ code: "custom", path: ["arrows"], message: `arrows needs one label per gap between steps (${props.steps.length - 1})` });
      }
    }),
});

/** A ledger page whose entries are written in one by one, with an optional ruled-off total. */
const LedgerRowSchema = z.strictObject({
  entry: z.string().min(1).max(24),
  amount: z.string().min(1).max(10),
  /** A small line above the entry ("Venice, 1494"). */
  date: z.string().min(1).max(20).optional(),
});
const LedgerPageSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("ledger-page"),
  props: z.strictObject({
    title: z.string().min(1).max(32),
    rows: z.array(LedgerRowSchema).min(1).max(5),
    total: z.strictObject({ entry: z.string().min(1).max(24), amount: z.string().min(1).max(10) }).optional(),
    factId: z.string().min(1).optional(),
  }),
});

const SceneSchema = z.discriminatedUnion("type", [
  TitleSceneSchema,
  BigNumberSceneSchema,
  LineChartSceneSchema,
  BarRaceSceneSchema,
  KineticTextSceneSchema,
  CompareSceneSchema,
  QuoteSceneSchema,
  TimelineSceneSchema,
  MapSceneSchema,
  ArchivalSceneSchema,
  FlowDiagramSceneSchema,
  LedgerPageSceneSchema,
]);

export const SCENE_TYPES: readonly Scene["type"][] = SceneSchema.options.map((option) => option.shape.type.value);

export const StoryboardSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    meta: z.strictObject({
      title: z.string().min(1),
      theme: z.literal("lombard-row"),
      /** The ground most scenes sit on (variation rule: no more than 2 videos in a row with the same lead). */
      paletteLead: z.enum(GROUNDS).default("ink"),
      /** The door number on the open and the end card: this video's place on the Row. */
      doorNo: z.number().int().min(1).max(999),
      /** Series label above the door number on the open, e.g. "How it works". */
      series: z.string().min(1).max(28),
      voice: z.string().min(1),
      /**
       * How the video opens. "title-card": a title scene with the door masthead. "cold": a moving visual from
       * frame 0 with the door number and title laid over it for 1.5 s at most. "bleed": a full-frame image from frame 0
       * with nothing over it; the door number and title come in at 2 s as a small corner tag.
       */
      open: z.enum(["title-card", "cold", "bleed"]).default("title-card"),
      /**
       * "classic": the layout of No. 001 to 003. "fast" (No. 004 on): a bleed open with a corner tag, bold captions in
       * the middle of the frame one to three words at a time, and the pacing rules in `pacingIssues` (src/skill/pacing.ts).
       */
      format: z.enum(["classic", "fast"]).default("classic"),
    }),
    audio: z.strictObject({ music: z.string().min(1).nullable() }),
    scenes: z.array(SceneSchema).min(1),
  })
  .superRefine((sb, ctx) => {
    const seen = new Set<string>();
    sb.scenes.forEach((scene, index) => {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "id"],
          message: `duplicate scene id "${scene.id}"`,
        });
      }
      seen.add(scene.id);
      scene.microhooks?.forEach((hook, i) => {
        if (!scene.narration.includes(hook)) {
          ctx.addIssue({ code: "custom", path: ["scenes", index, "microhooks", i], message: `microhook "${hook}" is not in scene "${scene.id}"'s narration word for word` });
        }
      });
    });
    if (sb.meta.format === "fast" && sb.meta.open !== "bleed") {
      ctx.addIssue({ code: "custom", path: ["meta", "open"], message: 'the fast format opens full-bleed: set meta.open to "bleed"' });
    }
  });

export type Storyboard = z.output<typeof StoryboardSchema>;
export type Scene = Storyboard["scenes"][number];
export type TitleProps = Extract<Scene, { type: "title" }>["props"];
export type BigNumberProps = Extract<Scene, { type: "big-number" }>["props"];
export type LineChartProps = Extract<Scene, { type: "line-chart" }>["props"];
export type KineticTextProps = Extract<Scene, { type: "kinetic-text" }>["props"];
export type CompareProps = Extract<Scene, { type: "compare" }>["props"];
export type QuoteProps = Extract<Scene, { type: "quote" }>["props"];
export type TimelineProps = Extract<Scene, { type: "timeline" }>["props"];
export type MapProps = Extract<Scene, { type: "map" }>["props"];
export type BarRaceProps = Extract<Scene, { type: "bar-race" }>["props"];
export type ArchivalProps = Extract<Scene, { type: "archival" }>["props"];
export type ArchivalShot = NonNullable<ArchivalProps["shots"]>[number];
export type FlowDiagramProps = Extract<Scene, { type: "flow-diagram" }>["props"];
export type LedgerPageProps = Extract<Scene, { type: "ledger-page" }>["props"];

/** Every fact a scene draws on: its own data facts, plus `sourceFactId` when it names one. */
export function factIdsOf(scene: Scene): string[] {
  const own = (() => {
    switch (scene.type) {
      case "compare": return [scene.props.left.factId, scene.props.right.factId];
      case "title": case "kinetic-text": case "archival": return [];
      case "flow-diagram": case "ledger-page": return scene.props.factId ? [scene.props.factId] : [];
      default: return [scene.props.factId];
    }
  })();
  return [...new Set([...own, ...(scene.sourceFactId ? [scene.sourceFactId] : []), ...(scene.speaks ?? [])])];
}

export function parseStoryboard(input: unknown): Storyboard {
  const result = StoryboardSchema.safeParse(input);
  if (!result.success) throw new StoryboardError(z.prettifyError(result.error));
  return result.data;
}
