import type { Storyboard } from "../schema/storyboard";

const PATTERNS: RegExp[] = [
  /\byou (?:should|must|need to|ought to) (?:buy|sell|invest|hold|short|own)\b/i,
  /\b(?:guaranteed?|risk[- ]free|sure thing|get rich)\b/i,
  /\b(?:can'?t|cannot|won'?t) (?:lose|fail)\b/i,
  /\b(?:buy|sell) (?:now|today|immediately)\b/i,
  /\bnot financial advice\b/i,
];

/** Advice-style or certainty phrasing in narration: the videos are educational and historical, never advice. */
export function adviceLint(sb: Storyboard): { sceneId: string; phrase: string }[] {
  const hits: { sceneId: string; phrase: string }[] = [];
  for (const scene of sb.scenes) {
    for (const pattern of PATTERNS) {
      const match = scene.narration.match(pattern);
      if (match) hits.push({ sceneId: scene.id, phrase: match[0] });
    }
  }
  return hits;
}
