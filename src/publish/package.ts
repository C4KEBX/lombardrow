import { doorLabelText } from "../devices/label";
import type { Assets } from "../schema/assets";
import type { Facts } from "../schema/facts";
import type { Storyboard } from "../schema/storyboard";
import { sentencesOf } from "../skill/scriptDoc";
import type { Plan } from "../variation/index";

/** The brand guidelines' standard description footer, word for word. */
export const FOOTER = "Sources are listed above. Education and history only, not financial, investment, tax or legal advice. Spot an error? Comment and we will correct it.";

/**
 * Scene types that look photorealistic and so need the platforms' AI label. None does today: every
 * scene is stylized motion graphics, and archival scenes show real public-domain scans, not AI images.
 * Add a type here if one is ever built that renders lifelike people or places.
 */
export const PHOTOREAL_SCENE_TYPES: readonly string[] = [];

const HASHTAGS = ["#LombardRow", "#MoneyHistory", "#Finance", "#History"];
export const YOUTUBE_TITLE_MAX = 100;

export const doorLabel = (doorNo: number): string => `No. ${doorLabelText(doorNo)}`;

export type PublishPackage = {
  doorNo: number;
  door: string;
  title: string;
  series: string;
  hook: string;
  sources: { name: string; url: string }[];
  images: { credit: string; url: string }[];
  aiDisclosure: { required: boolean; scenes: string[]; reason: string };
  youtube: { title: string; description: string };
  tiktok: { caption: string };
  instagram: { caption: string };
};

/** Every distinct source link, primary first as the facts list them, then corroboration. */
function sourcesOf(facts: Facts): { name: string; url: string }[] {
  const seen = new Set<string>();
  const out: { name: string; url: string }[] = [];
  for (const s of facts.facts.flatMap((f) => [f.source, ...(f.corroboration ?? [])])) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push({ name: s.name, url: s.url });
  }
  return out;
}

/** Titles, descriptions and captions for each platform, with the sources, the footer and the same door number everywhere. */
export function buildPublishPackage(sb: Storyboard, facts: Facts, opts: { plan?: Plan; assets?: Assets } = {}): PublishPackage {
  const title = opts.plan?.title ?? sb.meta.title;
  const door = doorLabel(sb.meta.doorNo);
  const hook = sentencesOf(sb.scenes[0].narration)[0] ?? "";
  const sources = sourcesOf(facts);
  const used = new Set(sb.scenes.flatMap((s) => (s.type === "archival" ? [s.props.assetId] : [])));
  const images = (opts.assets?.assets ?? []).filter((a) => used.has(a.id)).map((a) => ({ credit: a.credit, url: a.sourceUrl }));
  const photoreal = sb.scenes.filter((s) => PHOTOREAL_SCENE_TYPES.includes(s.type)).map((s) => s.id);

  const sourceBlock = [
    "Sources:",
    ...sources.map((s) => `- ${s.name}: ${s.url}`),
    ...(images.length ? ["", "Images:", ...images.map((i) => `- ${i.credit} ${i.url}`)] : []),
  ].join("\n");
  const tags = HASHTAGS.join(" ");
  const ytSuffix = ` | Lombard Row ${door}`;
  const ytTitle = title.length + ytSuffix.length <= YOUTUBE_TITLE_MAX ? `${title}${ytSuffix}` : title.slice(0, YOUTUBE_TITLE_MAX);

  return {
    doorNo: sb.meta.doorNo,
    door,
    title,
    series: sb.meta.series,
    hook,
    sources,
    images,
    aiDisclosure: photoreal.length
      ? { required: true, scenes: photoreal, reason: "photorealistic scenes: set YouTube's \"AI use\" disclosure and TikTok's AI label" }
      : { required: false, scenes: [], reason: "stylized motion graphics and public-domain scans only; no photorealistic AI scene" },
    youtube: {
      title: ytTitle,
      description: [hook, "", `Lombard Row ${door} · ${sb.meta.series}`, "", sourceBlock, "", FOOTER, "", `${tags} #Shorts`].join("\n"),
    },
    // TikTok and YouTube are searched: lead with the title's keywords.
    tiktok: { caption: [`${title} | Lombard Row ${door}`, hook, "", sourceBlock, "", FOOTER, "", tags].join("\n") },
    // Instagram shows one line before "more": lead with the hook.
    instagram: { caption: [hook, "", `${title} | Lombard Row ${door}`, "", sourceBlock, "", FOOTER, "", tags].join("\n") },
  };
}
