import fs from "node:fs";
import path from "node:path";
import { parseStoryboard } from "../src/schema/storyboard";
import { MAX_VIDEO_MS, MIN_VIDEO_MS } from "../src/schema/validate";
import { parseFlags } from "../src/skill/flags";
import { VISUAL_SCENES, checkPlan, crossCheck, parseHistory, parsePlan, parseSpec, scriptOf, suggest } from "../src/variation/index";

const USAGE = `Usage:
  npm run variation -- suggest [--history H]
  npm run variation -- check --plan P [--storyboard S] [--duration SECONDS] [--history H]
  npm run variation -- record --plan P --storyboard S --duration SECONDS [--history H]   (after publishing)`;

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));

try {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseFlags(rest, { values: ["--plan", "--storyboard", "--history", "--spec", "--duration"] });
  const spec = parseSpec(readJson(values.get("--spec") ?? path.resolve("variation/variation_spec.json")));
  const historyPath = values.get("--history") ?? path.resolve("videos/history.jsonl");
  const history = fs.existsSync(historyPath) ? parseHistory(fs.readFileSync(historyPath, "utf-8")) : [];

  if (command === "suggest") {
    console.log(`${history.length} published video${history.length === 1 ? "" : "s"} in history. Allowed next, least recently used first:`);
    for (const [name, options] of Object.entries(suggest(history, spec))) {
      const shown = options.map((o) => (name === "primaryVisual" && VISUAL_SCENES[o]?.length === 0 ? `${o} (scene not built yet)` : o));
      console.log(`  ${name.padEnd(14)} ${shown.join(", ") || "(none: loosen a window in variation_spec.json)"}`);
    }
  } else if (command === "check" || command === "record") {
    const planPath = values.get("--plan");
    if (!planPath) throw new Error(USAGE);
    const plan = parsePlan(readJson(planPath));
    const sbPath = values.get("--storyboard");
    const sb = sbPath ? parseStoryboard(readJson(sbPath)) : undefined;
    const duration = values.has("--duration") ? Number(values.get("--duration")) : plan.durationSeconds;
    const script = sb ? scriptOf(sb) : plan.script;
    const report = checkPlan(plan, history, spec, script);
    const reasons = [...report.reasons, ...(sb ? crossCheck(plan, sb, spec) : [])];
    if (duration !== undefined && (duration < MIN_VIDEO_MS / 1000 || duration > MAX_VIDEO_MS / 1000)) reasons.push(`length ${duration} s is outside ${MIN_VIDEO_MS / 1000}-${MAX_VIDEO_MS / 1000} s`);
    if (command === "record") {
      if (!sb || duration === undefined) throw new Error(USAGE);
      if (reasons.length) throw new Error(`not recording a plan that fails:\n  ${reasons.join("\n  ")}`);
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.appendFileSync(historyPath, `${JSON.stringify({ ...plan, script, durationSeconds: duration, publishedAt: new Date().toISOString() })}\n`);
      console.log(`Recorded No. ${plan.doorNo} in ${historyPath}`);
    } else {
      for (const r of reasons) console.log(`FAIL ${r}`);
      console.log(reasons.length ? `FAIL: ${reasons.length} reason${reasons.length === 1 ? "" : "s"}` : `OK (checked against ${history.length} published videos)`);
      if (reasons.length) process.exit(1);
    }
  } else {
    throw new Error(USAGE);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(2);
}
