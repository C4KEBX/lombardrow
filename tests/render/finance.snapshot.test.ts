import { describe, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/standin";
import { expectMatchesGolden } from "./snapshotHelper";

const SETTLE_MARGIN = 10; // frames before the exit fade starts (it begins 8 frames before the end)

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);

// Two frames per chart scene: mid-animation and settled. Offsets come from the composed scenes.
const targets: { name: string; frame: number }[] = [];
for (const scene of built.scenes) {
  const start = scene.startFrame; // scenes begin after the 2 s open
  if (scene.scene.type === "line-chart" || scene.scene.type === "bar-race") {
    targets.push({ name: `${scene.id}-mid`, frame: start + Math.round(scene.durationFrames * 0.45) });
    targets.push({ name: `${scene.id}-end`, frame: start + scene.durationFrames - SETTLE_MARGIN });
  }
}

describe("FinanceDemo chart snapshots", () => {
  for (const { name, frame } of targets) {
    it(`${name} (frame ${frame}) matches the golden image`, async () => {
      await expectMatchesGolden("FinanceDemo", "finance", name, frame);
    });
  }
});
