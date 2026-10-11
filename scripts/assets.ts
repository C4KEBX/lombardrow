import path from "node:path";
import { readAssets } from "../src/pipeline/assets";
import { fetchAssets } from "../src/pipeline/fetchAssets";
import { parseFlags } from "../src/skill/flags";

try {
  const { values, flags } = parseFlags(process.argv.slice(2), { values: ["--assets"], booleans: ["--force"] });
  const file = values.get("--assets");
  if (!file) throw new Error("Usage: npm run assets -- --assets videos/<slug>/assets.json [--force]");
  const assetsFile = path.resolve(file);
  fetchAssets(assetsFile, readAssets(assetsFile), { force: flags.has("--force") })
    .then((lines) => console.log(lines.join("\n")))
    .catch((error: Error) => {
      console.error(`assets failed: ${error.message}`);
      process.exit(1);
    });
} catch (error) {
  console.error(`assets failed: ${(error as Error).message}`);
  process.exit(2);
}
