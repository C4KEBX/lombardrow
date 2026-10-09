import fs from "node:fs";
import path from "node:path";
import { SIGNOFF } from "../src/devices/tracks";
import { expectedWords, listenBack, renderListenBack } from "../src/qa/listenBack";
import { namePrompt, transcribe } from "../src/qa/whisper";
import { parseStoryboard } from "../src/schema/storyboard";
import { parseFlags } from "../src/skill/flags";
import { outDirFor } from "../src/pipeline/renderDir";

const USAGE = "Usage: npm run listen-back -- --storyboard videos/<slug>/storyboard.json [--out DIR]   (after produce; DIR defaults to renders/no-XXX/final)";

async function main(): Promise<void> {
  const { values } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--out", "--model"] });
  const sbPath = values.get("--storyboard");
  if (!sbPath) throw new Error(USAGE);
  const outDir = outDirFor(sbPath, values.get("--out"));
  const manifestPath = path.join(outDir, "manifest.json");
  const video = path.join(outDir, "final.mp4");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(video)) throw new Error(`${outDir} has no final.mp4 and manifest.json; run npm run produce first`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { captions?: { text: string; startMs: number }[] };
  if (!manifest.captions) throw new Error("manifest.json has no captions; produce the video again with this version");
  const sb = parseStoryboard(JSON.parse(fs.readFileSync(sbPath, "utf-8")));
  const heard = await transcribe(video, outDir, { model: values.get("--model"), prompt: namePrompt(sb.scenes.map((s) => s.narration)) });
  const report = listenBack(expectedWords(sb.scenes, manifest.captions, SIGNOFF), heard);
  fs.writeFileSync(path.join(outDir, "listen-back.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "listen-back.md"), renderListenBack(report));
  const numbers = report.mismatches.filter((m) => m.number).length;
  console.log(`Listen-back: ${report.mismatches.length} differing passages (${numbers} with numbers), ${report.drift.length} caption drifts (transcript offset ${report.offsetMs} ms). See ${path.join(outDir, "listen-back.md")}`);
}

main().catch((error: Error) => {
  console.error(`listen-back failed: ${error.message}`);
  process.exit(1);
});
