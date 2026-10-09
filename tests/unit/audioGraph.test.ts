import { describe, expect, it } from "vitest";
import { AMBIENT_DB, DUCK, TARGET, assertLoudnessOk, buildAudioGraph, parseLoudnorm } from "../../src/audio/graph";

const measure = { inputI: -22.75, inputTp: -10.67, inputLra: 1, inputThresh: -32.87, targetOffset: -0.3 };

describe("buildAudioGraph", () => {
  it("delays each narration clip to its scene start and mixes them", () => {
    const g = buildAudioGraph({ clipStartsMs: [0, 4333.4], hasMusic: false, totalSeconds: 10 });
    expect(g).toContain("[0:a]adelay=0|0,");
    expect(g).toContain("[1:a]adelay=4333|4333,");
    expect(g).toContain("amix=inputs=2:normalize=0:duration=longest[narr]");
    expect(g).toContain("apad=whole_dur=10");
    expect(g.endsWith("[out]")).toBe(true);
  });
  it("handles a single clip without amix", () => {
    const g = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5 });
    expect(g).toContain("[n0]anull[narr]");
    expect(g).not.toContain("amix=inputs=1");
  });
  it("adds ducked, faded music only when there is music, sinking nothing and using the right input index", () => {
    const without = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5 });
    expect(without).not.toContain("sidechaincompress");
    const withMusic = buildAudioGraph({ clipStartsMs: [0, 2000], hasMusic: true, totalSeconds: 5 });
    expect(withMusic).toContain("[2:a]");
    expect(withMusic).toContain(`sidechaincompress=${DUCK}`);
    expect(withMusic).toContain(`volume=${AMBIENT_DB}dB`);
    expect(withMusic).toContain("atrim=0:5,afade=t=in:d=0.4,afade=t=out:st=3.5:d=1.5");
    expect(withMusic).toContain("asplit=2[narrA][narrB]");
    expect(withMusic).toContain("[narrB][ducked]amix=inputs=2:normalize=0:duration=longest[mix0]");
    expect(buildAudioGraph({ clipStartsMs: [0], hasMusic: true, totalSeconds: 5, musicGainDb: -12.5 })).toContain("volume=-12.5dB[music]");
  });
  it("splits each sound file once per cue, levels and delays every cue, and mixes them beside the voice and music", () => {
    const g = buildAudioGraph({
      clipStartsMs: [0], hasMusic: true, totalSeconds: 5,
      sfx: { files: 2, cues: [{ file: 0, atMs: 100, gainDb: -20 }, { file: 1, atMs: 900.4, gainDb: -18 }, { file: 0, atMs: 2000, gainDb: -26 }] },
    });
    // inputs: clip 0, music 1, sound files 2 and 3
    expect(g).toContain("[2:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[s0][s2]");
    expect(g).toContain("[3:a]aformat=sample_rates=44100:channel_layouts=stereo,anull[s1]");
    expect(g).toContain("[s1]volume=-18dB,adelay=900|900[c1]");
    expect(g).toContain("[c0][c1][c2]amix=inputs=3:normalize=0:duration=longest[sfx]");
    expect(g).toContain("[narrB][ducked][sfx]amix=inputs=3");
    const noMusic = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5, sfx: { files: 1, cues: [{ file: 0, atMs: 0, gainDb: -20 }] } });
    expect(noMusic).toContain("[1:a]");
    expect(noMusic).toContain("[c0]anull[sfx]");
    expect(noMusic).toContain("[narrP][sfx]amix=inputs=2");
  });
  it("measures with loudnorm json on pass 1 and applies measured values linearly on pass 2", () => {
    const pass1 = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5 });
    expect(pass1).toContain(`loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`);
    const pass2 = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5, measure });
    expect(pass2).toContain("measured_I=-22.75:measured_TP=-10.67:measured_LRA=1:measured_thresh=-32.87:offset=-0.3:linear=true");
  });
  it("rejects an empty clip list", () => {
    expect(() => buildAudioGraph({ clipStartsMs: [], hasMusic: false, totalSeconds: 5 })).toThrow(RangeError);
  });
});

describe("parseLoudnorm", () => {
  const stderr = `[Parsed_loudnorm_11 @ 0x7f99] \n{\n\t"input_i" : "-22.75",\n\t"input_tp" : "-10.67",\n\t"input_lra" : "1.00",\n\t"input_thresh" : "-32.87",\n\t"output_i" : "-13.70",\n\t"output_tp" : "-1.65",\n\t"output_lra" : "1.40",\n\t"output_thresh" : "-23.79",\n\t"normalization_type" : "dynamic",\n\t"target_offset" : "-0.30"\n}\n[out#0/null @ 0x7f99] video:0KiB`;
  it("reads the input measurements", () => {
    expect(parseLoudnorm(stderr)).toEqual({
      inputI: -22.75, inputTp: -10.67, inputLra: 1, inputThresh: -32.87, targetOffset: -0.3,
    });
  });
  it("throws a clear error when there is no json block", () => {
    expect(() => parseLoudnorm("no json here")).toThrow(/loudnorm/);
  });
  it("throws when the audio is silent (-inf measurements)", () => {
    const silent = stderr.replace('"-22.75"', '"-inf"');
    expect(() => parseLoudnorm(silent)).toThrow(/silent/);
  });
});

describe("near-silent audio", () => {
  const mk = (i: string) => `{\n"input_i" : "${i}",\n"input_tp" : "-30.00",\n"input_lra" : "1.00",\n"input_thresh" : "-60.00",\n"target_offset" : "0.00"\n}`;
  it("rejects measurements quieter than -50 LUFS as silent, and accepts audible ones", () => {
    expect(() => parseLoudnorm(mk("-55.0"))).toThrow(/silent/);
    expect(() => parseLoudnorm(mk("-45.0"))).not.toThrow();
  });
});

describe("assertLoudnessOk", () => {
  const m = (inputI: number, inputTp: number) => ({ inputI, inputTp, inputLra: 2, inputThresh: -24, targetOffset: 0 });
  it("accepts -14 LUFS within 1 LU and a true peak at or below -1.5", () => {
    expect(() => assertLoudnessOk(m(-14.16, -1.6))).not.toThrow();
    expect(() => assertLoudnessOk(m(-13.1, -1.5))).not.toThrow();
  });
  it("rejects loudness outside the tolerance and a true peak above -1.5", () => {
    expect(() => assertLoudnessOk(m(-12.5, -3))).toThrow(/-12\.5 LUFS/);
    expect(() => assertLoudnessOk(m(-14, -1.42))).toThrow(/-1\.42 dBTP/);
  });
  it("uses a loudnorm true-peak target below the -1.5 ceiling to leave room for the AAC encode", () => {
    expect(TARGET.TP).toBeLessThan(-1.5);
  });
});
