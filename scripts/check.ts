import fs from "node:fs";
import { checkStoryboard, formatReport } from "../src/skill/check";
import { parseFlags } from "../src/skill/flags";

try {
  const { values, flags } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts"], booleans: ["--json"] });
  const need = (flag: string): string => {
    const v = values.get(flag);
    if (!v) throw new Error(`Missing required flag ${flag}`);
    return v;
  };
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));
  const report = checkStoryboard(read(need("--storyboard")), read(need("--facts")));
  console.log(flags.has("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(`check failed: ${(error as Error).message}`);
  process.exit(2);
}
