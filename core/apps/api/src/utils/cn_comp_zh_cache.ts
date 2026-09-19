/**
 * 中国大陆比赛 cubing.com 中文地点 + 退赛/重开报名时间 —— PG 写穿缓存。
 *
 * 流程:
 * - 请求 /v1/cubing-zh/:wcaId → 先查 cn_comp_zh 表,命中秒返回。
 * - DB miss → scrape cubing.com → upsert → 返回(写穿)。
 * - 启动 30s 后 + 每天:遍历 all_upcoming_comps.json 里 CN 比赛,
 *   DB 没有 / fetched_at > 7d 的串行 scrape,500ms 间隔避免 cubing.com 限流。
 */
import { query } from '../db/connection.js';
import { parseHTML } from 'linkedom';
import { nameToCubingSlug } from '@cuberoot/shared/cubing-slug';
import { getUpcomingComps, getUpcomingCnCompName } from './upcoming_comps_cache.js';

export interface CnCompZh {
  location: string | null;
  withdrawDeadline: string | null;
  reopenAt: string | null;
  nameZh: string | null; // cubing.com 原始中文全名(含 WCA/魔方),前端 stripWcaPrefix 后展示
}

const EMPTY: CnCompZh = { location: null, withdrawDeadline: null, reopenAt: null, nameZh: null };
const CUBING_BASE = 'https://cubing.com';
const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';
const SCRAPE_DELAY_MS = 500;
const STALE_DAYS = 7;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** 兼容旧版 dl 与新版带嵌套标签的地点、报名时间轴。 */
export function parseCnCompZh(html: string): CnCompZh {
  const { document } = parseHTML(html);
  const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() || null;
  const fields = new Map<string, string>();
  for (const label of document.querySelectorAll('dt, [data-active-timeline] p')) {
    const value = label.nextElementSibling;
    if (!value || (label.tagName === 'DT' ? value.tagName !== 'DD' : value.tagName !== 'P')) continue;
    const copy = value.cloneNode(true) as typeof value;
    // 旧版退赛日期后可能附带暂停报名说明，不并入时间值。
    copy.querySelectorAll('.text-info').forEach(note => note.remove());
    const text = clean(copy.textContent);
    if (text) fields.set(clean(label.textContent) ?? '', text);
  }
  const date = (...labels: string[]): string | null => {
    const text = labels.map(label => fields.get(label)).find(Boolean);
    const match = text?.match(/^(\d{4})(?:年|-)(\d{1,2})(?:月|-)(\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second = '00'] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}:${second}`;
  };
  const name = clean(document.querySelector('h1')?.textContent);
  const location = fields.get('地点');
  return {
    location: location && /[一-鿿]/.test(location) ? location.replace(/\s*·\s*/g, ' ') : null,
    withdrawDeadline: date('退赛截止时间'),
    reopenAt: date('重开报名时间', '报名重启时间'),
    nameZh: name && /[一-鿿]/.test(name) ? name : null,
  };
}

interface DbRow {
  location_zh: string | null;
  withdraw_deadline: string | null;
  reopen_at: string | null;
  name_zh: string | null;
}

async function fetchFromDb(wcaId: string): Promise<CnCompZh | null> {
  const rows = await query<DbRow>(
    `SELECT location_zh, withdraw_deadline, reopen_at, name_zh FROM cn_comp_zh
     WHERE wca_id = ? AND location_zh IS NOT NULL AND name_zh IS NOT NULL
       AND fetched_at > NOW() - INTERVAL '${STALE_DAYS} days'`,
    [wcaId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { location: r.location_zh, withdrawDeadline: r.withdraw_deadline, reopenAt: r.reopen_at, nameZh: r.name_zh };
}

async function upsert(wcaId: string, meta: CnCompZh): Promise<void> {
  await query(
    `INSERT INTO cn_comp_zh (wca_id, location_zh, withdraw_deadline, reopen_at, name_zh, fetched_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON CONFLICT (wca_id) DO UPDATE SET
       location_zh = EXCLUDED.location_zh,
       withdraw_deadline = EXCLUDED.withdraw_deadline,
       reopen_at = EXCLUDED.reopen_at,
       name_zh = EXCLUDED.name_zh,
       fetched_at = NOW()`,
    [wcaId, meta.location, meta.withdrawDeadline, meta.reopenAt, meta.nameZh],
  );
}

async function scrapeAndUpsert(wcaId: string, compName: string): Promise<CnCompZh> {
  const slug = nameToCubingSlug(compName);
  try {
    const res = await fetch(`${CUBING_BASE}/competition/${encodeURIComponent(slug)}?lang=zh`, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return EMPTY;
    const html = await res.text();
    const meta = parseCnCompZh(html);
    if (meta.location || meta.nameZh) await upsert(wcaId, meta);
    return meta;
  } catch (e) {
    console.warn(`[cn-comp-zh] scrape ${wcaId}:`, (e as Error).message);
    return EMPTY;
  }
}

async function resolveCnName(wcaId: string): Promise<string | null> {
  // wca_competitions 表(周更 WCA dump)
  const rows = await query<{ name: string; country_id: string }>(
    `SELECT name, country_id FROM wca_competitions WHERE id = ?`,
    [wcaId],
  );
  if (rows.length > 0 && rows[0].country_id === 'China') return rows[0].name;
  // 新公示比赛兜底:upcoming_comps 缓存
  const fromUpcoming = await getUpcomingCnCompName(wcaId);
  if (fromUpcoming) return fromUpcoming;
  // 当天刚公示:WCA dump(周更)+ upcoming 缓存都还没收录 → 直接问 WCA API 拿名字 + 国家。
  // client 只对 CN 比赛调本端点,这里再按 country_iso2 复核一次,非 CN 不 scrape。
  try {
    const res = await fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const j = (await res.json()) as { name?: string; country_iso2?: string };
      if (j.country_iso2 === 'CN' && j.name) return j.name;
    }
  } catch (e) {
    console.warn(`[cn-comp-zh] WCA API name lookup ${wcaId}:`, (e as Error).message);
  }
  return null;
}

/** 取中文元数据。DB 命中 = 秒;miss → scrape cubing.com + upsert。 */
export async function getCnCompZh(wcaId: string): Promise<CnCompZh> {
  const dbRow = await fetchFromDb(wcaId);
  if (dbRow) return dbRow;
  const compName = await resolveCnName(wcaId);
  if (!compName) return EMPTY;
  return scrapeAndUpsert(wcaId, compName);
}

/** 启动 + 每日:批量预热 upcoming CN 比赛,DB 缺的 / fetched_at > 7d 的串行 scrape。 */
export async function warmCnCompZh(): Promise<void> {
  try {
    const upcoming = await getUpcomingComps();
    const cn = upcoming.filter((c) => c.country === 'CN');
    if (cn.length === 0) return;
    const ids = cn.map((c) => c.id);
    const placeholders = ids.map(() => '?').join(',');
    // 旧解析器在上游改版后写下的空地点也需要重新抓取。
    const fresh = await query<{ wca_id: string }>(
      `SELECT wca_id FROM cn_comp_zh WHERE wca_id IN (${placeholders}) AND fetched_at > NOW() - INTERVAL '${STALE_DAYS} days' AND name_zh IS NOT NULL AND location_zh IS NOT NULL`,
      ids,
    );
    const freshSet = new Set(fresh.map((r) => r.wca_id));
    const stale = cn.filter((c) => !freshSet.has(c.id));
    if (stale.length === 0) {
      console.log(`[cn-comp-zh] warm: ${cn.length} CN comps, all fresh`);
      return;
    }
    console.log(`[cn-comp-zh] warm: scraping ${stale.length} / ${cn.length} CN comps`);
    let ok = 0;
    for (const comp of stale) {
      await new Promise((r) => setTimeout(r, SCRAPE_DELAY_MS));
      const meta = await scrapeAndUpsert(comp.id, comp.name);
      if (meta.location || meta.withdrawDeadline || meta.reopenAt) ok++;
    }
    console.log(`[cn-comp-zh] warm: done (${ok}/${stale.length} populated)`);
  } catch (e) {
    console.warn('[cn-comp-zh] warm failed:', (e as Error).message);
  }
}
