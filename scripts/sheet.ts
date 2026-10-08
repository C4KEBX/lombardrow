import path from "node:path";
import { parseFlags } from "../src/skill/flags";
import { renderSheet } from "../src/skill/sheetRender";

const { values } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts", "--out", "--verify"] });
const need = (flag: string): string => {
  const v = values.get(flag);
  if (!v) {
    console.error(`sheet failed: Missing required flag ${flag}`);
    process.exit(2);
  }
  return path.resolve(v);
};
renderSheet({
  storyboardPath: need("--storyboard"),
  factsPath: need("--facts"),
  outDir: need("--out"),
  verifyPath: values.get("--verify") ? path.resolve(values.get("--verify") as string) : undefined,
})
  .then((file) => console.log(`Review sheet: ${file}`))
  .catch((error: Error) => {
    console.error(`sheet failed: ${error.message}`);
    process.exit(1);
  });
