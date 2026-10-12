import { execFile } from "node:child_process";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { Assets } from "../schema/assets";
import { isBlockedAddress, isBlockedUrl } from "../skill/verifyFacts";
import { assetPath } from "./assets";

const run = promisify(execFile);
const MAX_BYTES = 60_000_000;
const MAX_EDGE = 2000;

export type FetchDeps = {
  fetch: typeof fetch;
  resolve: (host: string) => Promise<string[]>;
  resize: (input: string, output: string) => Promise<void>;
};

const defaultDeps: FetchDeps = {
  fetch,
  resolve: async (host) => (await dns.promises.lookup(host, { all: true, verbatim: true })).map((a) => a.address),
  // Longest edge at most 2000 px, as a JPEG: small enough to inline into every render.
  resize: async (input, output) => {
    await run("ffmpeg", [
      "-y", "-loglevel", "error", "-i", input,
      "-vf", `scale='if(gt(iw,ih),min(${MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_EDGE},ih))'`,
      "-q:v", "3", output,
    ]);
  },
};

/** Downloads each asset with a downloadUrl whose file is missing (or all, with force), resized for rendering. */
export async function fetchAssets(assetsFile: string, assets: Assets, opts: { force?: boolean } = {}, deps: FetchDeps = defaultDeps): Promise<string[]> {
  const report: string[] = [];
  for (const asset of assets.assets) {
    const target = assetPath(assetsFile, asset);
    if (fs.existsSync(target) && !opts.force) {
      report.push(`have      ${asset.id}  ${asset.file}`);
      continue;
    }
    if (!asset.downloadUrl) {
      report.push(`missing   ${asset.id}  no downloadUrl; save the image to ${asset.file} by hand`);
      continue;
    }
    const url = new URL(asset.downloadUrl);
    if (isBlockedUrl(url.toString()) || (await deps.resolve(url.hostname)).some(isBlockedAddress)) {
      throw new Error(`asset "${asset.id}": refusing to fetch ${asset.downloadUrl}`);
    }
    const response = await deps.fetch(url, { headers: { "user-agent": "lombard-row-assets/1.0" }, redirect: "follow" });
    if (!response.ok) throw new Error(`asset "${asset.id}": HTTP ${response.status} from ${asset.downloadUrl}`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error(`asset "${asset.id}": ${asset.downloadUrl} is ${type || "not an image"}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_BYTES) throw new Error(`asset "${asset.id}": larger than ${MAX_BYTES / 1e6} MB`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const raw = `${target}.download`;
    fs.writeFileSync(raw, body);
    try {
      await deps.resize(raw, target);
    } finally {
      fs.rmSync(raw, { force: true });
    }
    report.push(`fetched   ${asset.id}  ${asset.file}`);
  }
  return report;
}
