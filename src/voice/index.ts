import { makeEdgeProvider } from "./edge";
import { makeStandinProvider } from "./standin";
import type { VoiceProvider } from "./types";

export type VoiceMode = "edge" | "standin";

export function makeVoiceProvider(mode: VoiceMode, cacheDir: string): VoiceProvider {
  if (mode === "edge") return makeEdgeProvider(cacheDir);
  if (mode === "standin") return makeStandinProvider(cacheDir);
  throw new Error(`Unknown voice mode "${String(mode)}" (expected "edge" or "standin")`);
}
