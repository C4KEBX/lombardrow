import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { probeDurationMs } from "../src/audio/probe";
import { outDirFor } from "../src/pipeline/renderDir";
import { frameName, parseSceneCuts, parseSilences, renderReviewPack, reviewFrameTimes } from "../src/qa/reviewPack";
import { parseFlags } from "../src/skill/flags";

const run = promisify(execFile);
const USAGE = "Usage: npm run review-pack -- --storyboard videos/<slug>/storyboard.json [--out DIR]   (after produce; writes DIR/viral/, DIR defaults to renders/no-XXX/final)";

/** ffmpeg's stderr, which is where its filters report; a failed run throws. */
async function ffmpegStderr(args: string[]): Promise<string> {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", ...args], { maxBuffer: 64 * 1024 * 1024 });
  return stderr;
}

async function main(): Promise<void> {
  const { values } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--out", "--video"] });
  const sbPath = values.get("--storyboard");
  if (!sbPath) throw new Error(USAGE);
  const outDir = outDirFor(sbPath, values.get("--out"));
  // Viewers hear music under the voice on every platform (TikTok adds it in the app), so review the mixed render when there is one.
  if (!fs.existsSync(outDir)) throw new Error(`${outDir} does not exist; run npm run produce first`);
  const mixed = fs.readdirSync(outDir).find((f) => /^no-\d{3}-mixed\.mp4$/.test(f));
  const video = values.get("--video") ?? path.join(outDir, mixed ?? "final.mp4");
  const manifestPath = path.join(outDir, "manifest.json");
  if (!fs.existsSync(video) || !fs.existsSync(manifestPath)) throw new Error(`${outDir} has no final.mp4 and manifest.json; run npm run produce first`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { captions?: { text: string; startMs: number }[]; loudness?: { inputI?: number } };

  const pack = path.join(outDir, "viral");
  const framesDir = path.join(pack, "frames");
  fs.rmSync(pack, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  fs.copyFileSync(video, path.join(pack, "final.mp4"));

  const durationS = (await probeDurationMs(video)) / 1000;
  const times = reviewFrameTimes(durationS);
  for (const t of times) {
    await run("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale=540:-1", "-q:v", "3", path.join(framesDir, frameName(t))]);
  }
  const cols = 8;
  await run("ffmpeg", [
    "-v", "error", "-y", "-pattern_type", "glob", "-i", path.join(framesDir, "t-*.jpg"),
    "-vf", `scale=180:-1,tile=${cols}x${Math.ceil(times.length / cols)}`, "-frames:v", "1", path.join(pack, "contact.jpg"),
  ]);

  const cuts = parseSceneCuts(await ffmpegStderr(["-i", video, "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"]));
  const silences = parseSilences(await ffmpegStderr(["-i", video, "-af", "silencedetect=n=-45dB:d=0.3", "-vn", "-f", "null", "-"]));
  const probe = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", video]);
  const [width, height] = probe.stdout.trim().split(",").map(Number);

  fs.writeFileSync(path.join(pack, "README.md"), renderReviewPack({
    durationS, width, height, loudnessLufs: manifest.loudness?.inputI ?? NaN, cuts, silences, words: manifest.captions ?? [], frames: times,
  }));
  console.log(`Review pack: ${times.length} frames, ${cuts.length} cuts, ${silences.length} silences. Give ${pack} to the viral-reviewer agent.`);
}

main().catch((error: Error) => {
  console.error(`review-pack failed: ${error.message}`);
  process.exit(1);
});
