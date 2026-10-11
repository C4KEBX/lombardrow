import type { Facts } from "../schema/facts";
import { factIdsOf, type Scene, type Storyboard } from "../schema/storyboard";
import { adviceLint } from "./adviceLint";
import { TARGET_SECONDS, countWords, estimateSeconds } from "./estimate";
import { factTokens } from "./verifyFacts";
import type { ScriptLine } from "./scriptDoc";
import type { VerifyResult, VerifyStatus } from "./verifyTypes";

export type ReviewModel = {
  title: string;
  scenes: { id: string; type: string; narration: string; image?: string; cues: string[]; factIds: string[] }[];
  facts: {
    id: string; claim: string; sourceName: string; sourceUrl: string; tier?: string; disputed: boolean;
    verify?: VerifyStatus | "stale"; evidence: string[]; archiveUrl?: string; flags: string[];
  }[];
  warnings: string[];
  stats: { scenes: number; words: number; estimatedSeconds: number };
  /** Every spoken sentence with its sources (the script document), when the sheet has it. */
  script?: ScriptLine[];
};

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const PLACEHOLDER = /demo data|verify before publishing|placeholder|todo/i;
const HAS_DIGIT = /\d/;


function titleOf(scene: Scene): string | undefined {
  return scene.type === "title" || scene.type === "kinetic-text" || scene.type === "big-number" || scene.type === "quote"
    ? undefined
    : scene.props.title;
}

function untracedTextWarnings(scene: Scene): string[] {
  const out: string[] = [];
  if (scene.type === "title") {
    for (const text of [scene.props.headline, scene.props.kicker]) {
      if (text && HAS_DIGIT.test(text)) out.push(`Scene "${scene.id}" (title) shows a number that is not tied to a fact: "${text}"; verify it`);
    }
  }
  const title = titleOf(scene);
  if (title && HAS_DIGIT.test(title)) out.push(`Scene "${scene.id}" (${scene.type}) title contains a number that is not tied to a fact: "${title}"; verify it`);
  const labels: [string, string | undefined][] =
    scene.type === "big-number"
      ? [["label", scene.props.label]]
      : scene.type === "compare"
        ? [["label", scene.props.left.label], ["label", scene.props.right.label]]
        : scene.type === "quote"
          ? [["attribution", scene.props.attribution]]
          : [];
  for (const [what, text] of labels) {
    if (text && HAS_DIGIT.test(text)) out.push(`Scene "${scene.id}" (${scene.type}) ${what} contains a number that is not tied to a fact: "${text}"; verify it`);
  }
  for (const cue of scene.cues) {
    if (cue.do === "callout" && cue.text) out.push(`Scene "${scene.id}" callout "${cue.text}" is not traced to a fact; verify it`);
  }
  return out;
}

/** A verify result is stale when the numbers it checked are no longer the fact's numbers (the fact was edited after verify-facts ran). */
function isStale(fact: Facts["facts"][number], result: VerifyResult): boolean {
  const checked = [...result.found, ...result.missing, ...(result.unverifiable ?? [])].sort();
  if (checked.length === 0) return false;
  const now = factTokens(fact).filter((t) => !t.includes(",")).sort();
  return checked.length !== now.length || checked.some((t, i) => t !== now[i]);
}

export function buildReviewModel(
  sb: Storyboard,
  facts: Facts,
  opts: { images: Record<string, string>; verify?: VerifyResult[] },
): ReviewModel {
  const verifyById = new Map((opts.verify ?? []).map((v) => [v.factId, v]));
  const used = new Set(sb.scenes.flatMap(factIdsOf));
  const warnings: string[] = sb.scenes.flatMap(untracedTextWarnings);
  const narrations = sb.scenes.map((s) => s.narration);
  const estimatedSeconds = Math.round(estimateSeconds(narrations) * 10) / 10;
  if (estimatedSeconds < TARGET_SECONDS.min || estimatedSeconds > TARGET_SECONDS.max) {
    warnings.push(`estimated length ${estimatedSeconds} s is outside ${TARGET_SECONDS.min}-${TARGET_SECONDS.max} s`);
  }
  for (const hit of adviceLint(sb)) warnings.push(`Scene "${hit.sceneId}" narration contains advice-style phrasing: "${hit.phrase}"`);
  for (const fact of facts.facts) {
    if (!used.has(fact.id)) warnings.push(`fact "${fact.id}" is not used by any scene`);
    const v = verifyById.get(fact.id);
    if (v && isStale(fact, v)) warnings.push(`fact "${fact.id}" source check is stale: the fact changed after verify-facts ran; re-run it`);
    else if (v && v.status !== "supported") warnings.push(`fact "${fact.id}" source check: ${v.status}${v.detail ? ` (${v.detail})` : ""}`);
  }
  return {
    title: sb.meta.title,
    scenes: sb.scenes.map((s) => ({
      id: s.id,
      type: s.type,
      narration: s.narration,
      image: opts.images[s.id],
      cues: s.cues.map((c) => `${c.do} on "${c.atWord}"${c.text ? `: ${c.text}` : ""}${c.x !== undefined ? ` (x ${c.x})` : ""}`),
      factIds: factIdsOf(s),
    })),
    facts: facts.facts.map((f) => ({
      id: f.id,
      claim: f.claim,
      sourceName: f.source.name,
      sourceUrl: f.source.url,
      tier: f.source.tier,
      disputed: f.disputed === true,
      verify: ((v) => (v && isStale(f, v) ? "stale" : v?.status))(verifyById.get(f.id)),
      evidence: (verifyById.get(f.id)?.evidence ?? []).map((ev) => `${ev.token}: "${ev.sentence}"`),
      archiveUrl: verifyById.get(f.id)?.archiveUrl,
      flags: PLACEHOLDER.test(f.claim) ? ["placeholder wording in the claim: replace with the verified claim"] : [],
    })),
    warnings,
    stats: { scenes: sb.scenes.length, words: narrations.reduce((n, t) => n + countWords(t), 0), estimatedSeconds },
  };
}

const IMAGE_URI = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const HTTP_URL = /^https?:\/\//i;

export function renderReviewHtml(model: ReviewModel): string {
  const e = escapeHtml;
  const scenes = model.scenes
    .map((s) => {
      if (s.image !== undefined && !IMAGE_URI.test(s.image)) throw new Error(`Scene "${s.id}": image must be a PNG data URI`);
      return `<section class="scene"><h3>${e(s.id)} <small>${e(s.type)}</small></h3>${
        s.image ? `<img src="${s.image}" alt="${e(s.id)}" width="270">` : ""
      }<p>${e(s.narration)}</p>${s.cues.length ? `<ul>${s.cues.map((c) => `<li>${e(c)}</li>`).join("")}</ul>` : ""}${
        s.factIds.length ? `<p class="meta">facts: ${s.factIds.map(e).join(", ")}</p>` : ""
      }</section>`;
    })
    .join("");
  const facts = model.facts
    .map((f) => {
      const link = HTTP_URL.test(f.sourceUrl) ? `<a href="${e(f.sourceUrl)}" rel="noopener noreferrer">${e(f.sourceName)}</a>` : e(f.sourceName);
      const snapshot = f.archiveUrl && HTTP_URL.test(f.archiveUrl) ? `<br><a href="${e(f.archiveUrl)}" rel="noopener noreferrer">snapshot</a>` : "";
      const evidence = f.evidence.length ? `<ul class="meta">${f.evidence.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : "";
      const tier = f.tier ? `<br><small>${e(f.tier)}</small>` : "";
      const disputed = f.disputed ? "<br><b>disputed: the narration must say so</b>" : "";
      return `<tr><td>${e(f.id)}</td><td>${e(f.claim)}${disputed}${f.flags.map((x) => `<br><b>${e(x)}</b>`).join("")}</td><td>${link}${tier}${snapshot}</td><td>${e(f.verify ?? "not checked")}${evidence}</td></tr>`;
    })
    .join("");
  const warnings = model.warnings.length
    ? `<h2>Warnings</h2><ul>${model.warnings.map((w) => `<li>${e(w)}</li>`).join("")}</ul>`
    : "<h2>Warnings</h2><p>None.</p>";
  const script = model.script
    ? `<h2>Script with sources</h2><table><tr><td>scene</td><td>narration</td><td>sources</td></tr>${model.script
        .map((l) => `<tr><td>${e(l.sceneId)}</td><td>${e(l.sentence)}</td><td>${l.factIds.length ? l.factIds.map(e).join(", ") : "<b>none named</b>"}${l.basis === "scene" ? " <small>(scene)</small>" : ""}</td></tr>`)
        .join("")}</table>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Review: ${e(model.title)}</title><style>body{font:14px system-ui;margin:24px;max-width:1200px;background:#fafafa;color:#111}.scene{display:inline-block;vertical-align:top;width:290px;margin:0 12px 24px 0}.scene img{border:1px solid #ccc;display:block}.meta,small{color:#666}table{border-collapse:collapse}td{border:1px solid #ddd;padding:4px 8px;vertical-align:top}</style></head><body><h1>${e(model.title)}</h1><p>${model.stats.scenes} scenes, ${model.stats.words} words, about ${model.stats.estimatedSeconds} s</p>${warnings}${script}<h2>Scenes</h2>${scenes}<h2>Facts</h2><table><tr><td>id</td><td>claim</td><td>source</td><td>source check</td></tr>${facts}</table></body></html>`;
}
