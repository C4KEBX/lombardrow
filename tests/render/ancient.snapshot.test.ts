import { describe, it } from "vitest";
import facts from "../../fixtures/ancient.facts.json";
import storyboard from "../../fixtures/ancient.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/standin";
import { expectMatchesGolden } from "./snapshotHelper";

const SETTLE_MARGIN = 10;

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);
const byId = (id: string) => built.scenes.find((s) => s.id === id)!;
const end = (id: string) => byId(id).startFrame + byId(id).durationFrames - SETTLE_MARGIN;
const cueAt = (id: string, i: number, after: number) => byId(id).startFrame + byId(id).cues[i].frame + after;

const targets = [
  { name: "map-mid", frame: cueAt("reach", 2, 6) },
  { name: "map-end", frame: end("reach") },
  { name: "timeline-mid", frame: cueAt("dates", 1, 6) },
  { name: "timeline-end", frame: end("dates") },
];

describe("AncientDemo snapshots", () => {
  for (const { name, frame } of targets) {
    it(`${name} (frame ${frame}) matches the golden image`, async () => {
      await expectMatchesGolden("AncientDemo", "ancient", name, frame);
    });
  }
});
