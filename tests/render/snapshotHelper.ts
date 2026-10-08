import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { PNG } from "pngjs";
import { expect } from "vitest";
import { diffRatio } from "../../src/testing/imageDiff";
import { browserExecutable, getServeUrl } from "../../src/testing/renderHelpers";

const GOLDEN_DIR = path.resolve("tests/render/golden");
const TMP_DIR = path.resolve("tests/render/_tmp");
const MAX_DIFF = 0.002;

/** Renders one frame of a composition and compares it with `<prefix>-<name>.png` (UPDATE_SNAPSHOTS=1 rewrites it). */
export async function expectMatchesGolden(compositionId: string, prefix: string, name: string, frame: number): Promise<void> {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, browserExecutable: browserExecutable(), id: compositionId });
  const output = path.join(TMP_DIR, `${prefix}-${name}.png`);
  await renderStill({ composition, serveUrl, browserExecutable: browserExecutable(), output, frame });

  const golden = path.join(GOLDEN_DIR, `${prefix}-${name}.png`);
  if (process.env.UPDATE_SNAPSHOTS === "1") {
    fs.copyFileSync(output, golden);
    return;
  }
  if (!fs.existsSync(golden)) {
    throw new Error(`Missing golden image ${golden}; run with UPDATE_SNAPSHOTS=1 and review it by eye`);
  }
  const ratio = diffRatio(PNG.sync.read(fs.readFileSync(output)), PNG.sync.read(fs.readFileSync(golden)));
  expect(ratio).toBeLessThanOrEqual(MAX_DIFF);
}
