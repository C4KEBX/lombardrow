import type { Storyboard } from "../schema/storyboard";

/** Advice, hype and vague-authority phrasing, from the brand's voice rules and Do/Don't table. */
const PATTERNS: RegExp[] = [
  /\byou (?:should|must|need to|ought to|have to) (?:start )?(?:buy|sell|invest|hold|short|own|save|pay)\w*\b/i,
  /\b(?:guaranteed?|risk[- ]free|sure thing|get rich)\b/i,
  /\b(?:can'?t|cannot|won'?t) (?:lose|fail)\b/i,
  /\b(?:buy|sell) (?:now|today|immediately)\b/i,
  /\bnot financial advice\b/i,
  /\byou'?ll regret\b/i,
  /\b(?:one )?weird trick\b/i,
  /\b(?:don'?t|do not) want you to know\b/i,
  /\bexperts (?:say|agree|recommend|warn)\b/i,
  /\bthe best way to (?:pay|invest|save|get|make|build|grow)\b/i,
  /\bas an? (?:financial|investment) (?:advisor|adviser|planner|expert)\b/i,
  /\bprice target\b/i,
  /\bwhat to buy\b/i,
  /\ba long time ago\b/i,
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

const TICKERS: RegExp[] = [
  /(?<![\w$])\$(?!(?:BN|MM|MN|TN|BIL|MIL)\b)[A-Z]{2,5}\b/, // cashtags ($AAPL), but not money units ($B, $M, $BN)
  /\b(?:NYSE|NASDAQ|Nasdaq|LSE|AMEX|TSX|ASX)\s*:\s*[A-Z][A-Z.]{0,5}\b/,
  /\bticker(?: symbol)?\s+[A-Z]{1,5}\b/,
];

function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

/** Ticker symbols anywhere in a scene, spoken or on screen. The brand never shows one. */
export function tickerHits(sb: Storyboard): { sceneId: string; ticker: string }[] {
  const hits: { sceneId: string; ticker: string }[] = [];
  for (const scene of sb.scenes) {
    for (const text of [scene.narration, ...stringsIn(scene.props), ...scene.cues.map((c) => c.text ?? "")]) {
      for (const pattern of TICKERS) {
        const match = text.match(pattern);
        if (match) hits.push({ sceneId: scene.id, ticker: match[0] });
      }
    }
  }
  return hits;
}
