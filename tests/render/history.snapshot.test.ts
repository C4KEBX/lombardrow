import { describe, it } from "vitest";
import facts from "../../fixtures/history.facts.json";
import storyboard from "../../fixtures/history.storyboard.json";
import { cutFrames } from "../../src/compose/wipe";
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
const firstCut = cutFrames(built.scenes)[0];

const targets = [
  { name: "kinetic-end", frame: end("east-west") },
  { name: "kinetic-emph", frame: byId("east-west").startFrame + byId("east-west").cues[0].frame + 12 },
  { name: "compare-end", frame: end("people") },
  { name: "quote-end", frame: end("veni") },
  { name: "wipe-cut", frame: firstCut },
  { name: "wipe-mid", frame: firstCut - 3 },
];

describe("HistoryDemo snapshots", () => {
  for (const { name, frame } of targets) {
    it(`${name} (frame ${frame}) matches the golden image`, async () => {
      await expectMatchesGolden("HistoryDemo", "history", name, frame);
    });
  }
});
