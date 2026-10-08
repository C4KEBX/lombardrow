import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAudioGraph } from "../../src/audio/graph";
import { generateAmbient } from "../../src/audio/music";
import { mixAudio, runFfmpeg } from "../../src/audio/mix";
import { meanVolumeDb } from "../../src/audio/probe";
import { makeStandinProvider } from "../../src/voice/standin";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mixb-"));
const TOTAL_MS = 11000;
const B_START_MS = 6000;

async function setup() {
  const provider = makeStandinProvider(path.join(dir, "cache"));
  const a = await provider("Stocks fell sharply in two thousand eight.", "v");
  const b = await provider("Then they climbed for eleven straight years.", "v");
  const clips = [
    { path: a.audioPath, startMs: 0 },
    { path: b.audioPath, startMs: B_START_MS },
  ];
  return { clips, aEnd: a.audioMs / 1000, bEnd: (B_START_MS + b.audioMs) / 1000, aFirst: a.words[0] };
}

describe("clip placement", () => {
  it("starts the second clip at its scene start, with silence before it", async () => {
    const { clips, aEnd } = await setup();
    const out = path.join(dir, "place.m4a");
    await mixAudio({ clips, totalMs: TOTAL_MS, outPath: out });
    expect(await meanVolumeDb(out, aEnd + 0.3, B_START_MS / 1000 - aEnd - 0.6)).toBeLessThan(-60);
    expect(await meanVolumeDb(out, B_START_MS / 1000 + 0.15, 0.3)).toBeGreaterThan(-45);
  });
});

describe("music bed", () => {
  it("loops a bed shorter than the video so music is still audible after the narration ends", async () => {
    const { clips, bEnd } = await setup();
    const bed = path.join(dir, "short.wav");
    await generateAmbient(6, bed);
    const withMusic = path.join(dir, "loop.m4a");
    await mixAudio({ clips, musicPath: bed, totalMs: TOTAL_MS, outPath: withMusic });
    const windowStart = bEnd + 0.4; // narration is over; only the (looped) music can be heard
    expect(await meanVolumeDb(withMusic, windowStart, TOTAL_MS / 1000 - windowStart - 0.2)).toBeGreaterThan(-55);
    const narrationOnly = path.join(dir, "no-music.m4a");
    await mixAudio({ clips, totalMs: TOTAL_MS, outPath: narrationOnly });
    expect(await meanVolumeDb(narrationOnly, windowStart, TOTAL_MS / 1000 - windowStart - 0.2)).toBeLessThan(-70);
  });

  it("ducks the music while the narration speaks (derived from the real graph's wiring)", async () => {
    const { clips, aFirst } = await setup();
    const bed = path.join(dir, "bed.wav");
    await generateAmbient(12, bed);
    const graph = buildAudioGraph({ clipStartsMs: clips.map((c) => c.startMs), hasMusic: true, totalSeconds: TOTAL_MS / 1000 });
    const duckedOnly = `${graph.split(";[narrB][ducked]")[0]};[narrB]anullsink;[ducked]anull[out]`;
    expect(duckedOnly).toContain("sidechaincompress");
    const out = path.join(dir, "ducked.wav");
    await runFfmpeg([
      "-y", ...clips.flatMap((c) => ["-i", c.path]), "-stream_loop", "-1", "-i", bed,
      "-filter_complex", duckedOnly, "-map", "[out]", "-t", String(TOTAL_MS / 1000), out,
    ]);
    const underNarration = await meanVolumeDb(out, aFirst.startMs / 1000 + 0.05, (aFirst.endMs - aFirst.startMs) / 1000 - 0.1);
    const inGap = await meanVolumeDb(out, 4.5, 1.0); // after clip a ends (~3.5 s), before clip b starts at 6 s
    expect(inGap - underNarration).toBeGreaterThan(8);
  });
});
