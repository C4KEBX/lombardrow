import fs from "node:fs";
import path from "node:path";
import { checkStoryboard, formatReport } from "../src/skill/check";
import { parseHistory, parseSpec } from "../src/variation/index";
import { parseFlags } from "../src/skill/flags";

try {
  const { values, flags } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts", "--plan", "--history"], booleans: ["--json"] });
  const need = (flag: string): string => {
    const v = values.get(flag);
    if (!v) throw new Error(`Missing required flag ${flag}`);
    return v;
  };
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));
  const planPath = values.get("--plan");
  const historyPath = values.get("--history") ?? path.resolve("videos/history.jsonl");
  const variation = planPath
    ? {
        plan: read(planPath),
        history: fs.existsSync(historyPath) ? parseHistory(fs.readFileSync(historyPath, "utf-8")) : [],
        spec: parseSpec(read(path.resolve("variation/variation_spec.json"))),
      }
    : undefined;
  const report = checkStoryboard(read(need("--storyboard")), read(need("--facts")), variation);
  console.log(flags.has("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(`check failed: ${(error as Error).message}`);
  process.exit(2);
}
