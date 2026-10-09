import { describe, it } from "vitest";
import facts from "../../fixtures/ledger.facts.json";
import storyboard from "../../fixtures/ledger.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/standin";
import { expectMatchesGolden } from "./snapshotHelper";

const SETTLE_MARGIN = 10;

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30, undefined,
  { "page-standin": { src: "unused", credit: "unused" } },
);
const byId = (id: string) => built.scenes.find((s) => s.id === id)!;
const end = (id: string) => byId(id).startFrame + byId(id).durationFrames - SETTLE_MARGIN;
const cue = (id: string, i: number) => byId(id).startFrame + byId(id).cues[i].frame;

const targets = [
  { name: "archival-start", frame: byId("page").startFrame + 20 },
  { name: "archival-end", frame: end("page") },
  { name: "flow-mid", frame: cue("doubling", 2) + 10 },
  { name: "flow-end", frame: end("doubling") },
  { name: "ledger-mid", frame: cue("accounts", 1) + 6 },
  { name: "ledger-end", frame: end("accounts") },
];

describe("LedgerDemo snapshots", () => {
  for (const { name, frame } of targets) {
    it(`${name} (frame ${frame}) matches the golden image`, async () => {
      await expectMatchesGolden("LedgerDemo", "ledger", name, frame);
    });
  }
});
