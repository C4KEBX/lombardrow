export type FlagSpec = { values: readonly string[]; booleans?: readonly string[] };

/** Minimal argv parser shared by the skill's CLIs: value flags need a value, boolean flags stand alone. */
export function parseFlags(argv: readonly string[], spec: FlagSpec): { values: Map<string, string>; flags: Set<string> } {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (spec.booleans?.includes(flag)) {
      flags.add(flag);
    } else if (spec.values.includes(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
      values.set(flag, value);
      i += 1;
    } else {
      throw new Error(`Unknown flag ${flag}`);
    }
  }
  return { values, flags };
}
