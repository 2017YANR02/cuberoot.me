import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_DB_PATH = '/var/lib/cuberoot-geoip/dbip-city-lite.mmdb';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 10_000;
const MAX_CONCURRENT_COMMANDS = 2;

export interface IpLocation {
  en: string;
  zh: string;
  precision: 'city' | 'country';
}

interface CacheEntry {
  expiresAt: number;
  value: IpLocation | null;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<IpLocation | null>>();
const commandWaiters: Array<() => void> = [];
let activeCommands = 0;

async function withCommandSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeCommands >= MAX_CONCURRENT_COMMANDS) {
    await new Promise<void>(resolve => commandWaiters.push(resolve));
  }
  activeCommands += 1;
  try {
    return await task();
  } finally {
    activeCommands -= 1;
    commandWaiters.shift()?.();
  }
}

function parseMmdbString(stdout: string): string | null {
  const match = stdout.match(/"((?:\\.|[^"\\])*)"\s+<utf8_string>/);
  if (!match) return null;
  try {
    const value = JSON.parse(`"${match[1]}"`);
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : null;
  } catch {
    return null;
  }
}

async function lookupString(ip: string, path: string[]): Promise<string | null> {
  const executable = process.env.GEOIP_LOOKUP_BIN || 'mmdblookup';
  const database = process.env.GEOIP_CITY_DB_PATH || DEFAULT_DB_PATH;
  try {
    const { stdout } = await withCommandSlot(() => execFileAsync(
      executable,
      ['--file', database, '--ip', ip, ...path],
      { timeout: 2_000, maxBuffer: 4_096, windowsHide: true },
    ));
    return parseMmdbString(stdout);
  } catch {
    return null;
  }
}

function joinPlace(country: string | null, city: string | null): string | null {
  const parts = [country, city].filter((value): value is string => Boolean(value));
  return parts.filter((value, index) => parts.indexOf(value) === index).join(' ') || null;
}

async function lookupIpLocation(ip: string): Promise<IpLocation | null> {
  const [cityEn, cityZh, countryEn, countryZh] = await Promise.all([
    lookupString(ip, ['city', 'names', 'en']),
    lookupString(ip, ['city', 'names', 'zh-CN']),
    lookupString(ip, ['country', 'names', 'en']),
    lookupString(ip, ['country', 'names', 'zh-CN']),
  ]);
  const en = joinPlace(countryEn ?? countryZh, cityEn ?? cityZh);
  const zh = joinPlace(countryZh ?? countryEn, cityZh ?? cityEn);
  if (!en || !zh) return null;
  return { en, zh, precision: cityEn || cityZh ? 'city' : 'country' };
}

/** Local MMDB lookup only: visitor IPs are never sent to a third-party API. */
export async function resolveIpLocation(ip: string): Promise<IpLocation | null> {
  if (!isIP(ip) || ip === '0.0.0.0' || ip === '::') return null;
  const now = Date.now();
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) cache.delete(ip);

  const existing = pending.get(ip);
  if (existing) return existing;

  const lookup = lookupIpLocation(ip).then(value => {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest) cache.delete(oldest);
    }
    cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }).finally(() => {
    pending.delete(ip);
  });
  pending.set(ip, lookup);
  return lookup;
}
