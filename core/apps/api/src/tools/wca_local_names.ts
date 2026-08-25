/**
 * WCA 本地名(CJK localName)补全 —— 忠实移植自退役的 Python wca_local_names.py。
 *
 * WCA Live GraphQL 的 person.name 不含括号(如 "Lim Hung"),WCA 主站 REST 返回
 * "Lim Hung (林弘)"。本模块从 REST 补查,把英文名升级成 "英文名 (本地名)",再交
 * record_format.splitName 拆出中文。结果缓存到本地(wca_local_names_cache.json,同目录,gitignored)。
 *
 * 自包含:用 WCA REST + fs,不碰 PG。服务器监控的 enrichName 走本地 wca_persons(monitors/names.ts),
 * 那是另一套语境;本工具是本地离线 CLI,沿用 Python 原版的 REST 补查。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(SCRIPT_DIR, 'wca_local_names_cache.json');
const WCA_PERSON_URL = 'https://www.worldcubeassociation.org/api/v0/persons/';

const HEADERS: Record<string, string> = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

let _cache: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (_cache !== null) return _cache;
  if (existsSync(CACHE_FILE)) {
    try {
      _cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as Record<string, string>;
    } catch {
      _cache = {};
    }
  } else {
    _cache = {};
  }
  return _cache;
}

function save(): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(_cache, null, 0), 'utf-8');
  } catch (e) {
    console.error(`[local-names] save cache failed: ${(e as Error).message}`);
  }
}

/** 返回 WCA 主站 name 字段(可能形如 'Lim Hung (林弘)' 或纯英文)。 */
async function fetchName(wcaId: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`${WCA_PERSON_URL}${wcaId}`, { headers: HEADERS, signal: ctrl.signal });
    // 对齐 Python raise_for_status:HTTP 错误抛出 → enrichName catch 返原名且不写 '' 哨兵(避免污染缓存)
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { name?: string };
    return j.name ?? '';
  } finally {
    clearTimeout(t);
  }
}

/**
 * name 含括号 / 无 wcaId 直接返回;否则查缓存 / WCA REST,有括号本地名才升级成
 * 'English (本地)',否则原样返回。
 *
 * 缓存语义:cache[wcaId] = "Lim Hung (林弘)" 有本地名 / "" 查过但无(避免反复请求)。
 */
export async function enrichName(name: string, wcaId: string | null | undefined): Promise<string> {
  if (!name || name.includes('(') || !wcaId) return name;
  const cache = load();
  if (wcaId in cache) {
    const cached = cache[wcaId];
    return cached ? cached : name;
  }
  let full: string;
  try {
    full = await fetchName(wcaId);
  } catch {
    return name;
  }
  cache[wcaId] = full.includes('(') ? full : '';
  save();
  return cache[wcaId] ? cache[wcaId]! : name;
}
