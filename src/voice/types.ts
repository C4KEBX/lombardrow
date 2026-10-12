import type { WordTiming } from "../schema/timing";

export type VoiceResult = { audioPath: string; words: WordTiming[]; audioMs: number };
export type VoiceProvider = (narration: string, voice: string) => Promise<VoiceResult>;

/** How much faster a brisk scene is voiced: about 10%, for the fast format's opening seconds. */
export const BRISK_RATE = "+10%";
/** The voice a scene is read in: the video's voice, sped up for a brisk scene. */
export const voiceFor = (scene: { brisk?: boolean }, voice: string): string => (scene.brisk ? `${voice}@${BRISK_RATE}` : voice);
