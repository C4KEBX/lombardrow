import type { VoiceMode } from "../voice/index";
import { outDirFor } from "./renderDir";

export type ProduceCliOptions = {
  storyboardPath: string;
  factsPath: string;
  /** Defaults to renders/no-XXX/final for the storyboard's door number. */
  outDir: string;
  voice: VoiceMode;
  enforceLength: boolean;
  remix: boolean;
  musicDir?: string;
  sfxDir?: string;
  cacheDir?: string;
  assetsPath?: string;
};

const VALUE_FLAGS = new Set(["--storyboard", "--facts", "--out", "--voice", "--music-dir", "--sfx-dir", "--cache-dir", "--assets"]);

export function parseArgs(argv: readonly string[]): ProduceCliOptions {
  const values = new Map<string, string>();
  let enforceLength = true;
  let remix = false;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--no-enforce-length") {
      enforceLength = false;
    } else if (flag === "--remix") {
      remix = true;
    } else if (VALUE_FLAGS.has(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
      values.set(flag, value);
      i += 1;
    } else {
      throw new Error(`Unknown flag ${flag}`);
    }
  }
  const required = (flag: string): string => {
    const value = values.get(flag);
    if (value === undefined) throw new Error(`Missing required flag ${flag}`);
    return value;
  };
  const voice = values.get("--voice") ?? "edge";
  if (voice !== "edge" && voice !== "standin") throw new Error(`--voice must be "edge" or "standin", got "${voice}"`);
  const storyboardPath = required("--storyboard");
  return {
    storyboardPath,
    factsPath: required("--facts"),
    outDir: outDirFor(storyboardPath, values.get("--out")),
    voice,
    enforceLength,
    remix,
    musicDir: values.get("--music-dir"),
    sfxDir: values.get("--sfx-dir"),
    cacheDir: values.get("--cache-dir"),
    assetsPath: values.get("--assets"),
  };
}
