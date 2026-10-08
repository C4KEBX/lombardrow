import dns from "node:dns";
import type { Facts } from "../schema/facts";
import type { VerifyResult } from "./verifyTypes";

type Fact = Facts["facts"][number];
type FetchLike = typeof fetch;

const MAX_BODY_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const TEXT_TYPES = /^(text\/html|text\/plain|application\/json|application\/xhtml\+xml)/i;
const SUPPORTED_AT = 0.6;

function ipv4Octets(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return m ? m.slice(1).map(Number) : null;
}

function blockedIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
  );
}

/** Eight 16-bit groups from any IPv6 spelling (:: compression, dotted tail), or null when it is not valid. */
function ipv6Groups(host: string): number[] | null {
  let text = host;
  const dotted = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const o = ipv4Octets(dotted[1]);
    if (!o || o.some((n) => n > 255)) return null;
    text = text.slice(0, -dotted[1].length) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const groups = part.split(":");
    return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g)) ? groups.map((g) => parseInt(g, 16)) : null;
  };
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - tail.length;
  return fill < 1 ? null : [...head, ...new Array<number>(fill).fill(0), ...tail];
}

const v4Of = (hi: number, lo: number): number[] => [hi >> 8, hi & 255, lo >> 8, lo & 255];

function blockedIpv6(host: string): boolean {
  const g = ipv6Groups(host);
  if (!g) return true; // not a valid literal: fail closed
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
  if (g.slice(0, 5).every((n) => n === 0) && (g5 === 0xffff || g5 === 0)) return blockedIpv4(v4Of(g6, g7)); // ::ffff:a.b.c.d, ::a.b.c.d, and :: itself
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return blockedIpv4(v4Of(g6, g7)); // NAT64
  if (g0 === 0x2002) return blockedIpv4(v4Of(g1, g2)); // 6to4
  return (
    (g0 === 0x64 && g1 === 0xff9b) || // local-use NAT64
    (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) || // discard-only
    (g0 === 0x2001 && (g1 === 0 || g1 === 0xdb8)) || // Teredo, documentation
    (g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0 || (g0 & 0xff00) === 0xff00
  );
}

/** True for an IP literal (as the URL parser prints it, or as DNS returns it) in a range the verifier must never contact. */
export function isBlockedAddress(raw: string): boolean {
  const host = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.includes(":")) return blockedIpv6(host);
  const o = ipv4Octets(host);
  return o !== null && blockedIpv4(o);
}

const hostnameOf = (url: URL): string => url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
const isIpLiteral = (host: string): boolean => host.includes(":") || ipv4Octets(host) !== null;

/** True for URLs the verifier must never fetch: non-web schemes, local names, and private/loopback/link-local addresses. DNS names are checked separately by resolving them. */
export function isBlockedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = hostnameOf(url);
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host) || host.endsWith(".home.arpa")) return true;
  return isBlockedAddress(host);
}

export type Resolver = (host: string) => Promise<string[]>;
const lookupAll: Resolver = async (host) => (await dns.promises.lookup(host, { all: true, verbatim: true })).map((a) => a.address);

function collectNumbers(value: unknown, out: number[]): void {
  if (typeof value === "number" && Number.isFinite(value)) out.push(Math.abs(value));
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, out));
}

const withCommas = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 10 });

/** Number strings a page should contain if it backs the fact. */
export function factTokens(fact: Fact): string[] {
  const numbers: number[] = [];
  if (fact.value !== undefined) numbers.push(Math.abs(fact.value));
  collectNumbers(fact.dataset, numbers);
  const tokens = new Set<string>();
  for (const n of numbers) {
    tokens.add(String(n));
    if (Math.abs(n) >= 1000) tokens.add(withCommas(n));
  }
  return [...tokens];
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

/** Drops script/style bodies and tags in one forward pass; every search resumes where the last ended, so cost stays linear. */
function stripMarkup(html: string): string {
  const lower = html.toLowerCase();
  const out: string[] = [];
  const noCloser = new Set<string>();
  let noMoreGt = false;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    out.push(html.slice(i, lt));
    i = lt;
    const name = (["script", "style"] as const).find((n) => lower.startsWith(n, lt + 1));
    if (name && !noCloser.has(name)) {
      const close = lower.indexOf(`</${name}>`, lt + 1 + name.length);
      if (close !== -1) {
        out.push(" ");
        i = close + name.length + 3;
        continue;
      }
      noCloser.add(name);
    }
    const gt = noMoreGt || html[lt + 1] === ">" ? -1 : html.indexOf(">", lt + 1);
    if (gt === -1) {
      if (html[lt + 1] !== ">") noMoreGt = true;
      out.push("<");
      i = lt + 1;
      continue;
    }
    out.push(" ");
    i = gt + 1;
  }
  out.push(html.slice(i));
  return out.join("");
}

export function htmlToText(html: string): string {
  return stripMarkup(html)
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

/** One entry per number: the plain form, satisfied by it or by its thousands-separated twin. */
function tokenGroups(tokens: readonly string[]): { token: string; variants: string[] }[] {
  return tokens
    .filter((t) => !t.includes(","))
    .map((token) => ({ token, variants: [token, ...tokens.filter((c) => c.includes(",") && c.replace(/,/g, "") === token)] }));
}

const hasToken = (text: string, token: string): boolean =>
  new RegExp(`(?<![\\d.,])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`).test(text);

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return ""; // no stream means no body; never buffer an uncapped text()
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks)).slice(0, MAX_BODY_BYTES);
}

export async function verifyFact(
  fact: Fact,
  fetchImpl: FetchLike = fetch,
  opts: { timeoutMs?: number; resolve?: Resolver } = {},
): Promise<VerifyResult> {
  const base = { factId: fact.id, url: fact.source.url, found: [] as string[], missing: [] as string[] };
  const tokens = factTokens(fact);
  let url = fact.source.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (isBlockedUrl(url)) return { ...base, status: "blocked", detail: `refusing to fetch ${url}` };
      const host = hostnameOf(new URL(url));
      if (!isIpLiteral(host)) {
        const addresses = await (opts.resolve ?? lookupAll)(host);
        const bad = addresses.find(isBlockedAddress);
        if (bad) return { ...base, status: "blocked", detail: `${host} resolves to ${bad}` };
      }
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "motion-explainers-fact-check/1.0", accept: "text/html,text/plain,application/json" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ...base, status: "unreachable", detail: "redirect without a location" };
        url = new URL(location, url).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) return { ...base, status: "unreachable", detail: `HTTP ${response.status}` };
      if (!TEXT_TYPES.test(response.headers.get("content-type") ?? "")) {
        return { ...base, status: "unreachable", detail: `content type ${response.headers.get("content-type") ?? "unknown"} is not checkable text` };
      }
      if (tokens.length === 0) return { ...base, status: "partial", detail: "nothing numeric to check; read the source yourself" };
      const text = htmlToText(await readCapped(response));
      const groups = tokenGroups(tokens);
      const found = groups.filter((g) => g.variants.some((v) => hasToken(text, v))).map((g) => g.token);
      const missing = groups.map((g) => g.token).filter((t) => !found.includes(t));
      const coverage = found.length / groups.length;
      const status = coverage === 1 ? "supported" : coverage >= SUPPORTED_AT ? "partial" : "not-found";
      return { ...base, status, found, missing };
    }
    return { ...base, status: "unreachable", detail: "too many redirects" };
  } catch (error) {
    return { ...base, status: "unreachable", detail: (error as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

/** Sequential on purpose: polite to the sources. */
export async function verifyFacts(facts: Facts, fetchImpl: FetchLike = fetch, opts: { resolve?: Resolver } = {}): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  for (const fact of facts.facts) results.push(await verifyFact(fact, fetchImpl, opts));
  return results;
}
