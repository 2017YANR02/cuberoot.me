/**
 * 选手页(/wca/persons/:wcaId)的自家数据源。
 *
 * 由来:这一页的首屏三个源(资料 / 全部成绩 / 参赛比赛)一直是浏览器直连 WCA 官网
 * `worldcubeassociation.org/api/v0`。站内其它页早就走自家 API,唯独这页把官网可达性
 * 顶在首屏前面 —— 官网从国内不通时,整页只有「加载中…」或「加载失败」。
 *
 * 端点:
 *   GET /v1/wca/person-page?wcaId=   一次给全:profile + results + comps(shape 对齐官网 API,前端类型不用改)
 *   GET /v1/wca/person-avatar?wcaId= 头像 URL(官方 dump 里没有头像,懒回源 + 入库缓存)
 *
 * 数据来源全部是每日 stats.yml 灌的库:
 *   wca_person_results(0098:一条成绩一行,含整轮 DNF 与轮次 pos)/ wca_persons / wca_competitions
 *   wca_person_ranks(21 项三档名次数组)/ wca_fs_medals / wca_fs_records_person / wca_fs_person_comps
 * 口径差异只有一处:官方 dump 天更 + 本管道每日 20:00 UTC 灌库,故最新一场比赛可能晚一天;
 * 这段窗口由 /v1/wca/person-live-results(直播·非官方)与前端的官网后台增强各补一半。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { buildPersonalRecords, countMedals, type PersonRanksRow } from '../utils/person_page.js';

export const wcaPersonRoutes = new Hono();

const WCA_ID_RE = /^[0-9]{4}[A-Z]{4}[0-9]{2}$/;

// 日更数据:浏览器短缓存(钉住的旧响应清不掉),长缓存留给 nginx —— 重灌后 stats.yml 会清 nginx。
const CACHE_HEADER = 'public, max-age=300, s-maxage=86400';

interface PersonRow { wca_id: string; name: string; gender: string | null; iso2: string | null }
interface ResultRow {
  comp_id: string; comp_date: string; event_id: string; round_type_id: string; format_id: string;
  pos: number; best: number; average: number; attempts: number[] | null;
  single_record: string; average_record: string;
}
interface RanksRow extends PersonRanksRow { is_avg: boolean }
interface CompRow { id: string; name: string; city: string | null; country_iso2: string | null; start_date: string | null; end_date: string | null }

wcaPersonRoutes.get('/wca/person-page', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!WCA_ID_RE.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);

  const [person] = await query<PersonRow>(
    `SELECT p.wca_id, p.name, p.gender, co.iso2
       FROM wca_persons p
       LEFT JOIN wca_countries co ON co.id = p.country_id
      WHERE p.wca_id = ?`,
    [wcaId],
  );
  if (!person) return c.json({ error: 'Not found' }, 404);

  const results = await query<ResultRow>(
    `SELECT comp_id, comp_date, event_id, round_type_id, format_id,
            pos, best, average, attempts, single_record, average_record
       FROM wca_person_results
      WHERE wca_id = ?
      ORDER BY comp_date, comp_id, event_id, round_type_id`,
    [wcaId],
  );
  // 空 = 该选手尚未进 0098 表(首次 bootstrap 前 / 极新选手)。让前端知道要退回官网,
  // 别把「一条成绩都没有」当成事实渲染出来。
  if (results.length === 0) return c.json({ error: 'No results in mirror', wcaId, pending: true }, 404);

  const compIds = [...new Set(results.map(r => r.comp_id))];
  const comps = await query<CompRow>(
    `SELECT id, name, city, country_iso2, start_date, end_date
       FROM wca_competitions
      WHERE id IN (${compIds.map(() => '?').join(',')})`,
    compIds,
  );

  const rankRows = await query<RanksRow>(
    `SELECT is_avg, ranks_world, ranks_country, ranks_continent FROM wca_person_ranks WHERE wca_id = ?`,
    [wcaId],
  );
  const singleRanks = rankRows.find(r => !r.is_avg);
  const avgRanks = rankRows.find(r => r.is_avg);

  const [records] = await query<{ wr: string | number; cr: string | number; nr: string | number }>(
    `SELECT COALESCE(SUM(wr),0) AS wr, COALESCE(SUM(cr),0) AS cr, COALESCE(SUM(nr),0) AS nr
       FROM wca_fs_records_person WHERE wca_id = ?`,
    [wcaId],
  );
  const [compCount] = await query<{ comp_count: number }>(
    `SELECT comp_count FROM wca_fs_person_comps WHERE wca_id = ?`,
    [wcaId],
  );

  // personal_records:值由本人成绩现算(最小有效值),名次取 person_ranks 的三档数组 ——
  // 官方 API 也是这两样拼的。装配逻辑在 utils/person_page.ts,对着官网响应有 parity 测试。
  const personalRecords = buildPersonalRecords(results, singleRanks, avgRanks);

  const n = (v: string | number | null | undefined): number => Number(v ?? 0) || 0;
  const { gold, silver, bronze } = countMedals(results);
  const world = n(records?.wr), continental = n(records?.cr), national = n(records?.nr);

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    wcaId,
    profile: {
      person: {
        id: person.wca_id,
        wca_id: person.wca_id,
        name: person.name,
        country_iso2: person.iso2 ?? '',
        gender: person.gender ?? null,
        url: `https://www.worldcubeassociation.org/persons/${person.wca_id}`,
      },
      competition_count: compCount?.comp_count ?? compIds.length,
      personal_records: personalRecords,
      medals: { gold, silver, bronze, total: gold + silver + bronze },
      records: { world, continental, national, total: world + continental + national },
    },
    results: results.map(r => ({
      competition_id: r.comp_id,
      event_id: r.event_id,
      round_type_id: r.round_type_id,
      format_id: r.format_id,
      best: r.best,
      average: r.average,
      pos: r.pos,
      attempts: r.attempts ?? [],
      regional_single_record: r.single_record || null,
      regional_average_record: r.average_record || null,
      date: r.comp_date,
    })),
    comps: comps.map(c2 => ({
      id: c2.id,
      name: c2.name,
      city: c2.city ?? '',
      country_iso2: c2.country_iso2 ?? '',
      start_date: c2.start_date,
      end_date: c2.end_date,
    })),
  });
});

// ── /v1/wca/person-avatar ───────────────────────────────────────────────
// 头像是唯一一样官方 dump 里没有的东西(它只在 WCA 网站的 API 响应里)。整页不该为一张图
// 卡住,所以单独一个端点:命中缓存直接返,没命中才由服务器出网拿(5KB 的 profile,~1.5s),
// 结果入库。官网不通 → 返回旧值 / null,前端退回首字母占位。
const AVATAR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AVATAR_TIMEOUT_MS = 8000;

wcaPersonRoutes.get('/wca/person-avatar', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!WCA_ID_RE.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);

  const [cached] = await query<{ url: string | null; thumb_url: string | null; checked_at: string }>(
    `SELECT url, thumb_url, checked_at FROM wca_person_avatar WHERE wca_id = ?`,
    [wcaId],
  );
  const fresh = cached && Date.now() - new Date(cached.checked_at).getTime() < AVATAR_TTL_MS;
  if (fresh) {
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return c.json({ wcaId, url: cached.url, thumbUrl: cached.thumb_url });
  }

  let url: string | null = null;
  let thumbUrl: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AVATAR_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://www.worldcubeassociation.org/api/v0/persons/${encodeURIComponent(wcaId)}`,
        { signal: ctrl.signal, headers: { 'User-Agent': 'cuberoot.me/1.0' } },
      );
      if (res.ok) {
        const j = await res.json() as { person?: { avatar?: { url?: string; thumb_url?: string; is_default?: boolean } } };
        const av = j.person?.avatar;
        // is_default = WCA 的占位灰头像,存它没意义(前端自己的首字母占位更好看)。
        if (av && !av.is_default) {
          url = av.url ?? null;
          thumbUrl = av.thumb_url ?? null;
        }
      }
    } finally {
      clearTimeout(timer);
    }
    await query(
      `INSERT INTO wca_person_avatar (wca_id, url, thumb_url, checked_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (wca_id) DO UPDATE SET url = EXCLUDED.url, thumb_url = EXCLUDED.thumb_url, checked_at = NOW()`,
      [wcaId, url, thumbUrl],
    );
  } catch {
    // 回源失败:有旧值就继续用旧值(头像几乎不变,过期无害),否则 null。
    if (cached) {
      c.header('Cache-Control', 'public, max-age=600');
      return c.json({ wcaId, url: cached.url, thumbUrl: cached.thumb_url, stale: true });
    }
    c.header('Cache-Control', 'no-store');
    return c.json({ wcaId, url: null, thumbUrl: null, stale: true });
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return c.json({ wcaId, url, thumbUrl });
});
