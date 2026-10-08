import fs from "node:fs";
import path from "node:path";
import { findAssets } from "../src/pipeline/assets";
import { renderChecklist } from "../src/publish/checklist";
import { buildPublishPackage } from "../src/publish/package";
import { renderThumbnails, writePackageTexts } from "../src/publish/writePackage";
import { parseFacts } from "../src/schema/facts";
import { parseStoryboard } from "../src/schema/storyboard";
import { parseFlags } from "../src/skill/flags";
import { checkPlan, crossCheck, parseHistory, parsePlan, parseSpec, scriptOf } from "../src/variation/index";

const USAGE = "Usage: npm run publish-kit -- --storyboard S --facts F --plan P --out out/<slug> [--history H]   (after produce)";
const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));

async function main(): Promise<void> {
  const { values } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts", "--plan", "--out", "--history", "--assets"] });
  const [sbPath, factsPath, planPath, outDir] = ["--storyboard", "--facts", "--plan", "--out"].map((f) => values.get(f));
  if (!sbPath || !factsPath || !planPath || !outDir) throw new Error(USAGE);
  const sb = parseStoryboard(readJson(sbPath));
  const plan = parsePlan(readJson(planPath));
  const pkg = buildPublishPackage(sb, parseFacts(readJson(factsPath)), { plan, assets: findAssets(sbPath, values.get("--assets"))?.assets });

  const manifestPath = path.join(outDir, "manifest.json");
  const durationSeconds = fs.existsSync(manifestPath) ? (readJson(manifestPath) as { durationMs: number }).durationMs / 1000 : undefined;
  // The final variation pass: plan, script and real length together.
  const historyPath = values.get("--history") ?? path.resolve("videos/history.jsonl");
  const history = fs.existsSync(historyPath) ? parseHistory(fs.readFileSync(historyPath, "utf-8")) : [];
  const spec = parseSpec(readJson(path.resolve("variation/variation_spec.json")));
  const variation = [...checkPlan(plan, history, spec, scriptOf(sb)).reasons, ...crossCheck(plan, sb, spec)];
  if (durationSeconds !== undefined && (durationSeconds < 65 || durationSeconds > 70)) variation.push(`length ${durationSeconds.toFixed(1)} s is outside 65-70 s`);
  const lbPath = path.join(outDir, "listen-back.json");
  const lb = fs.existsSync(lbPath) ? (readJson(lbPath) as { mismatches: unknown[]; drift: unknown[] }) : undefined;

  const dir = path.join(outDir, "publish");
  const texts = writePackageTexts(pkg, dir);
  const thumbnails = await renderThumbnails(pkg, dir);
  fs.writeFileSync(
    path.join(dir, "checklist.md"),
    renderChecklist(pkg, { durationSeconds, variation, listenBack: lb && { mismatches: lb.mismatches.length, drift: lb.drift.length }, thumbnails }),
  );
  console.log(`Publish package in ${dir}: ${[...texts, ...thumbnails, "checklist.md"].join(", ")}`);
  if (variation.length) console.log(`Variation check FAILED:\n  ${variation.join("\n  ")}`);
  if (pkg.aiDisclosure.required) console.log(`AI disclosure REQUIRED: ${pkg.aiDisclosure.reason}`);
}

main().catch((error: Error) => {
  console.error(`publish-kit failed: ${error.message}`);
  process.exit(1);
});
