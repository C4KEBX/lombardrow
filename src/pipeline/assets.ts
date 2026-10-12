import fs from "node:fs";
import path from "node:path";
import { parseAssets, type Asset, type Assets } from "../schema/assets";
import { imageSize } from "./imageSize";

export type SceneImages = Record<string, { src: string; credit: string; width?: number; height?: number }>;

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export const assetPath = (assetsFile: string, asset: Asset): string => path.resolve(path.dirname(assetsFile), asset.file);

export function readAssets(assetsFile: string): Assets {
  return parseAssets(JSON.parse(fs.readFileSync(assetsFile, "utf-8")));
}

/** Every downloaded asset as an inline data URI, so renders stay offline and need no static server. */
export function loadSceneImages(assetsFile: string, assets: Assets): SceneImages {
  const out: SceneImages = {};
  for (const asset of assets.assets) {
    const file = assetPath(assetsFile, asset);
    if (!fs.existsSync(file)) continue;
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`asset "${asset.id}": ${asset.file} must be .jpg, .png or .webp`);
    const bytes = fs.readFileSync(file);
    out[asset.id] = { src: `data:${mime};base64,${bytes.toString("base64")}`, credit: asset.credit, ...sizeOrNothing(bytes) };
  }
  return out;
}

/** assets.json from an explicit path, or next to the storyboard when it exists there. */
export function findAssets(storyboardPath: string, explicit?: string): { file: string; assets: Assets } | undefined {
  const file = explicit ?? path.join(path.dirname(storyboardPath), "assets.json");
  if (!explicit && !fs.existsSync(file)) return undefined;
  return { file, assets: readAssets(file) };
}

/** Images for every downloaded asset, or none when the video has no assets.json. */
export function imagesFor(storyboardPath: string, explicit?: string): SceneImages {
  const found = findAssets(storyboardPath, explicit);
  return found ? loadSceneImages(found.file, found.assets) : {};
}

/** The image's pixel size when its header can be read; bleed shots need it, and `buildVideo` says so if it is missing. */
function sizeOrNothing(bytes: Buffer): { width?: number; height?: number } {
  try {
    return imageSize(bytes);
  } catch {
    return {};
  }
}
