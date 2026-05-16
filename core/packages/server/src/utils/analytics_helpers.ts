/**
 * Traffic-analytics helpers: visitor-id hash, UA classifier, referrer normalizer,
 * country lookup (MaxMind GeoLite2 mmdb).
 *
 * Privacy: 不存原始 IP / 完整 UA. visitor_id = sha256(ip||ua||day||SALT) 截 16 字节,
 * 每日 rotate → 只能 daily-unique UV, 跨日不可追踪.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { open as openMmdb, type Reader, type CountryResponse } from 'maxmind';

const ANALYTICS_SALT = (() => {
  const v = process.env.ANALYTICS_SALT;
  if (v) return v;
  // Refuse to silently degrade in prod — known dev salt = visitor_id is precomputable.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ANALYTICS_SALT must be set in production');
  }
  return 'dev-analytics-salt-not-secret';
})();
const MMDB_PATH = process.env.GEOIP_MMDB || '/usr/share/GeoIP/GeoLite2-Country.mmdb';

let mmdbReader: Reader<CountryResponse> | null = null;
let mmdbLoaded = false;

async function getMmdb(): Promise<Reader<CountryResponse> | null> {
  if (mmdbLoaded) return mmdbReader;
  mmdbLoaded = true;
  if (!existsSync(MMDB_PATH)) {
    console.warn(`[analytics] no GeoLite2 mmdb at ${MMDB_PATH}; country will be NULL`);
    return null;
  }
  try {
    mmdbReader = await openMmdb<CountryResponse>(MMDB_PATH);
    return mmdbReader;
  } catch (err) {
    console.warn('[analytics] failed to open mmdb:', err);
    return null;
  }
}

export async function lookupCountry(ip: string): Promise<string | null> {
  if (!ip || ip === '0.0.0.0' || ip === '::1' || ip.startsWith('127.')) return null;
  const reader = await getMmdb();
  if (!reader) return null;
  try {
    const result = reader.get(ip);
    return result?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}

/**
 * Daily-rotating visitor id. Same (ip, ua) inside one UTC day → same hash;
 * 24h later → different hash. 16 bytes is plenty for collision resistance at our scale.
 */
export function makeVisitorId(ip: string, ua: string, date: Date = new Date()): Buffer {
  const day = date.toISOString().slice(0, 10);
  const h = createHash('sha256');
  h.update(ip);
  h.update('\0');
  h.update(ua);
  h.update('\0');
  h.update(day);
  h.update('\0');
  h.update(ANALYTICS_SALT);
  return h.digest().subarray(0, 16);
}

/**
 * Coarse UA classifier. Matches common bots first, then mobile/tablet markers.
 * Default = desktop.
 */
// Narrower than a casual /bot|crawl|.../ — avoids catching "GamingMonitor" / iMessage
// link preview / Apple URLSession-FetchRequest etc which are legitimate UA fragments.
// \b boundaries + explicit names. Anything not matching here falls through to ua class.
const BOT_RE = /\b(googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|seznambot|sogou|exabot|bytespider|amazonbot|gptbot|claudebot|ccbot|chatgpt-user|perplexity|crawler|spider|headless|curl|wget|python-requests|node-fetch|libwww|httpclient|axios\/|okhttp\/|go-http-client|java\/)\b/i;
const TABLET_RE = /ipad|tablet|playbook|kindle|silk|nexus 7|nexus 10/i;
const MOBILE_RE = /mobile|iphone|ipod|android|blackberry|windows phone|opera mini|opera mobi/i;

export function classifyUa(ua: string): 'desktop' | 'mobile' | 'tablet' | 'bot' {
  if (!ua) return 'bot';
  if (BOT_RE.test(ua)) return 'bot';
  if (TABLET_RE.test(ua)) return 'tablet';
  if (MOBILE_RE.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Normalize referrer to eTLD+1 (or full hostname for unknown TLDs).
 * Strips protocol/path/query. Returns null for empty/own-site/same-host.
 *
 * Not a full PSL parser — uses a small heuristic that handles common cases
 * (google.com, google.co.uk, baidu.com, etc) correctly. Edge cases of multi-part
 * country-code TLDs (.com.au, .co.jp, .ne.kr) are folded too.
 */
const TWO_PART_TLDS = new Set([
  'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.in', 'co.za', 'co.il',
  'com.au', 'com.br', 'com.cn', 'com.hk', 'com.tw', 'com.sg', 'com.mx',
  'ne.jp', 'or.jp', 'ac.uk', 'ac.jp', 'ac.cn', 'gov.uk', 'gov.cn',
  'org.uk', 'org.cn', 'net.au', 'net.cn',
]);

export function normalizeReferrer(referrer: string | undefined, ownHost?: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  if (ownHost && (host === ownHost || host === `www.${ownHost}` || host.endsWith(`.${ownHost}`))) {
    return null;
  }
  if (host.startsWith('www.')) host = host.slice(4);
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  if (TWO_PART_TLDS.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return last2;
}

/**
 * Extract client IP from nginx-set X-Real-IP only. We do NOT fall back to
 * client-controllable X-Forwarded-For: Hono binds 0.0.0.0:3001 and a peer
 * with direct access could otherwise spoof IP → spoof visitor_id / country.
 */
export function getClientIp(headerLookup: (name: string) => string | undefined): string {
  return headerLookup('x-real-ip') ?? '0.0.0.0';
}

/**
 * Truncate string to a max byte length, for safe storage.
 */
export function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Path validator — SPA routes are ascii + a few reserved chars.
 * Rejects oversized / non-route garbage so attackers can't bloat the path-index
 * cardinality by spamming distinct random paths.
 */
const PATH_RE = /^\/[A-Za-z0-9/_\-.:%~@()]{0,200}$/;
export function validPath(p: string): boolean {
  return PATH_RE.test(p);
}

/**
 * HMAC-signed dwell ticket. /pv returns { id, t } where t is a short HMAC of
 * (id || visitor_id || ts_minute || SALT). /dwell requires the t back, so an
 * attacker without the original visitor_id can't poison rows they didn't write.
 * 12 hex chars (48 bits) is enough — guess space ~3e14, rate-limited to 5/s.
 */
export function makeDwellTicket(id: number, visitor_id: Buffer): string {
  const h = createHmac('sha256', ANALYTICS_SALT);
  h.update(String(id));
  h.update('\0');
  h.update(visitor_id);
  return h.digest('hex').slice(0, 12);
}

export function verifyDwellTicket(id: number, visitor_id: Buffer, ticket: string): boolean {
  if (typeof ticket !== 'string' || ticket.length !== 12) return false;
  const expected = makeDwellTicket(id, visitor_id);
  // 12-char hex strings, constant-time compare.
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(ticket, 'hex'));
  } catch {
    return false;
  }
}
