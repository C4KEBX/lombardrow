import { z } from "zod";
import { StoryboardError, type Storyboard } from "./storyboard";

/** Only images anyone may reuse without permission: public domain or CC0. */
export const ASSET_LICENSES = ["public-domain", "cc0"] as const;

const httpUrl = z.url().refine((u) => /^https?:\/\//i.test(u), "url must be http(s)");

const AssetSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, "asset id must be lowercase letters, digits, hyphens"),
  /** Path of the downloaded image, relative to assets.json (e.g. "assets/summa.jpg"). */
  file: z.string().min(1).refine((f) => !f.startsWith("/") && !f.split(/[\\/]/).includes(".."), "file must stay inside the video folder"),
  /** The page that states the image's license (e.g. its Wikimedia Commons file page). */
  sourceUrl: httpUrl,
  /** Direct link to the image file, for `npm run assets` to download. */
  downloadUrl: httpUrl.optional(),
  license: z.enum(ASSET_LICENSES, { message: `license must be ${ASSET_LICENSES.join(" or ")}; any other license cannot be used` }),
  /** Shown on the image: who made or holds it, and its license ("Jacopo de' Barbari, 1495. Public domain."). */
  credit: z.string().min(1).max(60),
  /** What the image actually shows, for the reviewer. */
  depicts: z.string().min(1),
});

export const AssetsSchema = z.strictObject({ assets: z.array(AssetSchema) }).superRefine((data, ctx) => {
  const seen = new Set<string>();
  data.assets.forEach((a, i) => {
    if (seen.has(a.id)) ctx.addIssue({ code: "custom", path: ["assets", i, "id"], message: `duplicate asset id "${a.id}"` });
    seen.add(a.id);
  });
});
export type Assets = z.output<typeof AssetsSchema>;
export type Asset = Assets["assets"][number];

export function parseAssets(input: unknown): Assets {
  const result = AssetsSchema.safeParse(input);
  if (!result.success) throw new StoryboardError(`assets.json: ${z.prettifyError(result.error)}`);
  return result.data;
}

/** Every archival scene names an asset in assets.json whose file has been downloaded. */
export function assertAssets(sb: Storyboard, assets: Assets | undefined, fileExists: (asset: Asset) => boolean): void {
  for (const scene of sb.scenes) {
    if (scene.type !== "archival") continue;
    if (!assets) throw new StoryboardError(`Scene "${scene.id}" (archival) needs assets.json; pass --assets`);
    const asset = assets.assets.find((a) => a.id === scene.props.assetId);
    if (!asset) throw new StoryboardError(`Scene "${scene.id}" uses asset "${scene.props.assetId}", which is not in assets.json`);
    if (!fileExists(asset)) {
      throw new StoryboardError(`Scene "${scene.id}": asset "${asset.id}" file ${asset.file} is missing; run npm run assets -- --assets <assets.json>`);
    }
  }
}
