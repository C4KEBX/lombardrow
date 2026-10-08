import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { diffRatio } from "../../src/testing/imageDiff";
import { browserExecutable, getServeUrl } from "../../src/testing/renderHelpers";

const GOLDEN_DIR = path.resolve("tests/render/golden");
const TMP_DIR = path.resolve("tests/render/_tmp");
const MAX_DIFF = 0.002; // 0.2% of pixels
const FRAMES = [40, 100, 150]; // title settled; number mid count-up; number settled with callout

describe("HelloBigNumber visual snapshots", () => {
  for (const frame of FRAMES) {
    it(`frame ${frame} matches the golden image`, async () => {
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.mkdirSync(TMP_DIR, { recursive: true });
      const serveUrl = await getServeUrl();
      const composition = await selectComposition({ serveUrl, browserExecutable: browserExecutable(), id: "HelloBigNumber" });
      const output = path.join(TMP_DIR, `hello-frame-${frame}.png`);
      await renderStill({ composition, serveUrl, browserExecutable: browserExecutable(), output, frame });

      const golden = path.join(GOLDEN_DIR, `hello-frame-${frame}.png`);
      if (process.env.UPDATE_SNAPSHOTS === "1") {
        fs.copyFileSync(output, golden);
        return; // golden (re)written; review it by eye before trusting it
      }
      if (!fs.existsSync(golden)) {
        throw new Error(`Missing golden image ${golden}; run with UPDATE_SNAPSHOTS=1 and review it by eye`);
      }
      const ratio = diffRatio(PNG.sync.read(fs.readFileSync(output)), PNG.sync.read(fs.readFileSync(golden)));
      expect(ratio).toBeLessThanOrEqual(MAX_DIFF);
    });
  }
});
