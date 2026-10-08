import type { WordTiming } from "../schema/timing";

export type VoiceResult = { audioPath: string; words: WordTiming[]; audioMs: number };
export type VoiceProvider = (narration: string, voice: string) => Promise<VoiceResult>;
