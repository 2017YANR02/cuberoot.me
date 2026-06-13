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
import { getUpcomingComps, getUpcomingCnCompName } from './upcoming_comps_cache.js';

export interface CnCompZh {
  location: string | null;
  withdrawDeadline: string | null;
  reopenAt: string | null;
}

const EMPTY: CnCompZh = { location: null, withdrawDeadline: null, reopenAt: null };
const CUBING_BASE = 'https://cubing.com';
const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';
const SCRAPE_DELAY_MS = 500;
const STALE_DAYS = 7;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function extractDd(html: string, label: string): string | null {
  const re = new RegExp(`<dt>\\s*${label}\\s*<\\/dt>\\s*<dd>([\\s\\S]*?)<\\/dd>`);
  const m = html.match(re);
  if (!m) return null;
  // dd 里可能套 <div class="text-info">(暂停报名说明),只取首个 tag 之前的纯文本
  const lead = m[1].split('<')[0].replace(/\s+/g, ' ').trim();
  return lead || null;
}

interface DbRow {
  location_zh: string | null;
  withdraw_deadline: string | null;
  reopen_at: string | null;
}

async function fetchFromDb(wcaId: string): Promise<CnCompZh | null> {
  const rows = await query<DbRow>(
    `SELECT location_zh, withdraw_deadline, reopen_at FROM cn_comp_zh WHERE wca_id = ?`,
    [wcaId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { location: r.location_zh, withdrawDeadline: r.withdraw_deadline, reopenAt: r.reopen_at };
}

async function upsert(wcaId: string, meta: CnCompZh): Promise<void> {
  await query(
    `INSERT INTO cn_comp_zh (wca_id, location_zh, withdraw_deadline, reopen_at, fetched_at)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (wca_id) DO UPDATE SET
       location_zh = EXCLUDED.location_zh,
       withdraw_deadline = EXCLUDED.withdraw_deadline,
       reopen_at = EXCLUDED.reopen_at,
       fetched_at = NOW()`,
    [wcaId, meta.location, meta.withdrawDeadline, meta.reopenAt],
  );
}

async function scrapeAndUpsert(wcaId: string, compName: string): Promise<CnCompZh> {
  const slug = compName.trim().replace(/['`‘’]/g, '').replace(/\s+/g, '-');
  try {
    const res = await fetch(`${CUBING_BASE}/competition/${encodeURIComponent(slug)}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' },
    });
    if (!res.ok) return EMPTY;
    const html = await res.text();
    const meta: CnCompZh = {
      location: extractDd(html, '地点'),
      withdrawDeadline: extractDd(html, '退赛截止时间'),
      reopenAt: extractDd(html, '重开报名时间'),
    };
    // 即使全 null 也写一行,避免下次再触发 scrape
    await upsert(wcaId, meta);
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
    const fresh = await query<{ wca_id: string }>(
      `SELECT wca_id FROM cn_comp_zh WHERE wca_id IN (${placeholders}) AND fetched_at > NOW() - INTERVAL '${STALE_DAYS} days'`,
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
