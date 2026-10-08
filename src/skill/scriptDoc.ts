import type { Assets } from "../schema/assets";
import type { Facts } from "../schema/facts";
import { figureMatches, figuresIn } from "../schema/figures";
import { factIdsOf, type Storyboard } from "../schema/storyboard";
import { factNumbers } from "../schema/validate";

type Fact = Facts["facts"][number];

/** One spoken sentence and the sources behind it. */
export type ScriptLine = {
  sceneId: string;
  sentence: string;
  /** Facts whose numbers the sentence says, or else the facts its scene names. */
  factIds: string[];
  /** How the sources were matched: by a figure the sentence says, by the scene, or none named. */
  basis: "figure" | "scene" | "none";
};

export type ScriptDoc = {
  title: string;
  doorNo: number;
  lines: ScriptLine[];
  facts: { id: string; claim: string; source: string; url: string; tier?: string; also: { name: string; url: string }[]; disputed: boolean }[];
  images: { id: string; credit: string; license: string; url: string; depicts: string }[];
};

export const sentencesOf = (narration: string): string[] =>
  narration.split(/(?<=[.!?]["')\]]?)\s+/).map((s) => s.trim()).filter(Boolean);

/** The script document for the fact-check gate: every spoken sentence with its source beside it. */
export function buildScriptDoc(sb: Storyboard, facts: Facts, assets?: Assets): ScriptDoc {
  const byId = new Map(facts.facts.map((f) => [f.id, f]));
  const lines: ScriptLine[] = sb.scenes.flatMap((scene) => {
    const named = factIdsOf(scene).flatMap((id) => (byId.has(id) ? [byId.get(id) as Fact] : []));
    return sentencesOf(scene.narration).map((sentence): ScriptLine => {
      const figures = figuresIn(sentence);
      const matched = named.filter((f) => figures.some((fig) => factNumbers(f).some((n) => figureMatches(fig.value, n))));
      if (matched.length) return { sceneId: scene.id, sentence, factIds: matched.map((f) => f.id), basis: "figure" };
      if (named.length) return { sceneId: scene.id, sentence, factIds: named.map((f) => f.id), basis: "scene" };
      return { sceneId: scene.id, sentence, factIds: [], basis: "none" };
    });
  });
  const usedImages = new Set(sb.scenes.flatMap((s) => (s.type === "archival" ? [s.props.assetId] : [])));
  return {
    title: sb.meta.title,
    doorNo: sb.meta.doorNo,
    lines,
    facts: facts.facts.map((f) => ({
      id: f.id, claim: f.claim, source: f.source.name, url: f.source.url, tier: f.source.tier,
      also: (f.corroboration ?? []).map((c) => ({ name: c.name, url: c.url })), disputed: f.disputed === true,
    })),
    images: (assets?.assets ?? []).filter((a) => usedImages.has(a.id)).map((a) => ({
      id: a.id, credit: a.credit, license: a.license, url: a.sourceUrl, depicts: a.depicts,
    })),
  };
}

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Markdown for the reviewer: script table, then a checklist of facts and images. */
export function renderScriptMarkdown(doc: ScriptDoc): string {
  const no = String(doc.doorNo).padStart(3, "0");
  const rows = doc.lines.map((l) => {
    const sources = l.factIds.length ? l.factIds.join(", ") : "none named";
    const note = l.basis === "scene" ? " (scene's facts; confirm the sentence)" : l.basis === "none" ? " (confirm it states no fact)" : "";
    return `| ${l.sceneId} | ${cell(l.sentence)} | ${sources}${note} |`;
  });
  const facts = doc.facts.map((f) => {
    const also = f.also.map((a) => `; also [${cell(a.name)}](${a.url})`).join("");
    return `- [ ] **${f.id}**: ${f.claim}${f.disputed ? " **Disputed: the narration must say so.**" : ""}\n  Source: [${f.source}](${f.url})${f.tier ? ` (${f.tier})` : ""}${also}`;
  });
  const images = doc.images.map((i) => `- [ ] **${i.id}**: ${i.depicts}. ${i.credit} ([${i.license}](${i.url}))`);
  return [
    `# No. ${no}: ${doc.title}`,
    "",
    "Script with sources, for the fact-check gate. Tick each fact once you have read it on its source page.",
    "",
    "| Scene | Narration | Sources |",
    "|---|---|---|",
    ...rows,
    "",
    "## Facts",
    "",
    ...facts,
    ...(images.length ? ["", "## Images", "", ...images] : []),
    "",
  ].join("\n");
}
