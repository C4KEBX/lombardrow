import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { browserExecutable, getServeUrl } from "../pipeline/bundle";
import type { ThumbnailProps } from "./Thumbnail";
import type { PublishPackage } from "./package";

/** Covers per platform: 9:16 for YouTube Shorts, TikTok and Reels, and Instagram's 3:4 profile-grid crop. */
export const THUMBNAILS = [
  { file: "thumb-youtube.png", width: 1080, height: 1920 },
  { file: "thumb-tiktok.png", width: 1080, height: 1920 },
  { file: "thumb-instagram.png", width: 1080, height: 1920 },
  { file: "thumb-instagram-grid.png", width: 1080, height: 1440 },
] as const;

export async function renderThumbnails(pkg: PublishPackage, outDir: string): Promise<string[]> {
  const serveUrl = await getServeUrl();
  const rendered = new Map<string, string>();
  const files: string[] = [];
  for (const t of THUMBNAILS) {
    const out = path.join(outDir, t.file);
    const key = `${t.width}x${t.height}`;
    const done = rendered.get(key);
    if (done) {
      fs.copyFileSync(done, out);
    } else {
      const inputProps: ThumbnailProps = { doorNo: pkg.doorNo, title: pkg.title, series: pkg.series, width: t.width, height: t.height };
      const composition = await selectComposition({ serveUrl, browserExecutable: browserExecutable(), id: "Thumbnail", inputProps });
      await renderStill({ composition, serveUrl, browserExecutable: browserExecutable(), output: out, frame: 0, inputProps });
      rendered.set(key, out);
    }
    files.push(t.file);
  }
  return files;
}

/** Writes the per-platform texts and package.json; returns the files written. */
export function writePackageTexts(pkg: PublishPackage, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const files: [string, string][] = [
    ["youtube.txt", `TITLE\n${pkg.youtube.title}\n\nDESCRIPTION\n${pkg.youtube.description}\n`],
    ["tiktok.txt", `${pkg.tiktok.caption}\n`],
    ["instagram.txt", `${pkg.instagram.caption}\n`],
    ["package.json", `${JSON.stringify(pkg, null, 2)}\n`],
  ];
  for (const [name, text] of files) fs.writeFileSync(path.join(outDir, name), text);
  return files.map(([name]) => name);
}
