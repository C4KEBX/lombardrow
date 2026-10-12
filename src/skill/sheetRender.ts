import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { VIDEO } from "../design/tokens";
import { findAssets, imagesFor } from "../pipeline/assets";
import { buildVideo, videoProps } from "../pipeline/buildVideo";
import { browserExecutable, getServeUrl } from "../pipeline/bundle";
import { parseFacts } from "../schema/facts";
import { parseStoryboard } from "../schema/storyboard";
import { synthWords } from "../voice/synthWords";
import { buildReviewModel, renderReviewHtml } from "./review";
import { buildScriptDoc, renderScriptMarkdown } from "./scriptDoc";
import type { VerifyResult } from "./verifyTypes";

const SETTLE_MARGIN = 10; // frames before the exit fade, as in the snapshot tests

export type SheetOptions = { storyboardPath: string; factsPath: string; outDir: string; verifyPath?: string; assetsPath?: string };

/** One settled still per scene (synthetic timing, no voice needed) plus review.html. Returns the html path. */
export async function renderSheet(opts: SheetOptions): Promise<string> {
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));
  const storyboardJson = read(opts.storyboardPath);
  const factsJson = read(opts.factsPath);
  const built = buildVideo(
    storyboardJson, factsJson,
    (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
    VIDEO.fps,
    undefined,
    imagesFor(opts.storyboardPath, opts.assetsPath),
  );
  fs.mkdirSync(opts.outDir, { recursive: true });
  const serveUrl = await getServeUrl();
  const inputProps = videoProps(built);
  const composition = await selectComposition({ serveUrl, browserExecutable: browserExecutable(), id: "Production", inputProps });
  const images: Record<string, string> = {};
  for (const scene of built.scenes) {
    const file = path.join(opts.outDir, `${scene.id}.png`);
    const frame = scene.startFrame + Math.max(0, scene.durationFrames - SETTLE_MARGIN);
    await renderStill({ composition, serveUrl, browserExecutable: browserExecutable(), output: file, frame, inputProps });
    images[scene.id] = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  }
  const verify = opts.verifyPath && fs.existsSync(opts.verifyPath) ? (read(opts.verifyPath) as VerifyResult[]) : undefined;
  const storyboard = parseStoryboard(storyboardJson);
  const facts = parseFacts(factsJson);
  const doc = buildScriptDoc(storyboard, facts, findAssets(opts.storyboardPath, opts.assetsPath)?.assets);
  fs.writeFileSync(path.join(opts.outDir, "script.md"), renderScriptMarkdown(doc));
  const model = { ...buildReviewModel(storyboard, facts, { images, verify }), script: doc.lines };
  const htmlPath = path.join(opts.outDir, "review.html");
  fs.writeFileSync(htmlPath, renderReviewHtml(model));
  return htmlPath;
}
