import path from "node:path";
import { formatVoiceReport, voiceCheck } from "../src/pipeline/voiceCheck";
import { makeVoiceProvider, type VoiceMode } from "../src/voice/index";

function parse(argv: readonly string[]): { storyboard: string; facts: string; voice: VoiceMode; cacheDir: string } {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!["--storyboard", "--facts", "--voice", "--cache-dir"].includes(flag)) throw new Error(`Unknown flag ${flag}`);
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    values.set(flag, value);
  }
  const storyboard = values.get("--storyboard");
  const facts = values.get("--facts");
  if (!storyboard || !facts) throw new Error("Usage: npm run voice -- --storyboard <file> --facts <file> [--voice edge|standin]");
  const voice = values.get("--voice") ?? "edge";
  if (voice !== "edge" && voice !== "standin") throw new Error(`--voice must be "edge" or "standin", got "${voice}"`);
  return { storyboard, facts, voice, cacheDir: values.get("--cache-dir") ?? path.resolve("out/voice-cache") };
}

(async () => {
  const opts = parse(process.argv.slice(2));
  const report = await voiceCheck(opts.storyboard, opts.facts, makeVoiceProvider(opts.voice, opts.cacheDir));
  console.log(formatVoiceReport(report));
  if (!report.withinGate) process.exit(1);
})().catch((error: Error) => {
  console.error(`voice failed: ${error.message}`);
  process.exit(1);
});
