/**
 * 粗饼(cubing.com)新比赛监控 —— 移植自 cubing_com_monitor.py。
 * 轮询 /api/competition,diff 已推 comp id,新比赛 Bark 推送(group cubing-comp)。
 * 文案格式与 WCA 监控对齐:无 emoji、ISO 日期、城市带 🇨🇳、项目数 + 上限。
 */
import { sendBark } from './bark.js';
import { countPushed, getPushedSet, markPushed, type MonitorId } from './state.js';
import { POLL_INTERVAL_MS, siteCompUrlFromCubingAlias, formatDateRangeIso } from './config.js';
import { startPoller } from './poll.js';

const MONITOR: MonitorId = 'cubing_comp';
const CUBING_API = 'https://cubing.com/api/competition';
const UA: Record<string, string> = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

interface CubingComp {
  id: number | string;
  name: string;
  alias?: string;
  url?: string;
  date: { from: number; to: number };
  locations?: { province?: string; city?: string }[];
  competitor_limit?: number;
  registered_competitors?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Unix 秒 → yyyy-mm-dd(中国比赛,按北京时区取日期,对齐旧 Python 本地 TZ 输出)。 */
function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ts * 1000));
}

async function queryCompetitions(): Promise<CubingComp[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(CUBING_API, { headers: UA, signal: ctrl.signal });
      if (r.ok) {
        const text = await r.text();
        if (text.trim()) {
          const data = JSON.parse(text) as { data?: CubingComp[] };
          return data.data ?? [];
        }
      }
      console.warn(`[cubing-comp] API returned ${r.status}, retry ${attempt + 1}/3`);
    } catch (e) {
      console.warn(`[cubing-comp] request failed: ${(e as Error).message}, retry ${attempt + 1}/3`);
    } finally {
      clearTimeout(t);
    }
    await sleep(3000);
  }
  return [];
}

/**
 * 项目数:粗饼 API 不含项目列表,而其比赛皆 WCA 赛(alias 去横杠=WCA id),
 * 转查 WCA REST 单赛端点拿 event_ids(与 WCA 监控同源)。失败/非 WCA 赛 → null,文案省略该段。
 */
async function fetchEventCount(alias: string | undefined): Promise<number | null> {
  if (!alias) return null;
  const wcaId = alias.replace(/-/g, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`https://www.worldcubeassociation.org/api/v0/competitions/${wcaId}`, {
      headers: { 'User-Agent': 'WCA-Monitor/1.0', Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { event_ids?: string[] };
    return data.event_ids?.length ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function formatCompMessage(comp: CubingComp): Promise<{ title: string; body: string; url: string }> {
  const dateStr = formatDateRangeIso(formatDate(comp.date.from), formatDate(comp.date.to));
  const loc = comp.locations?.[0];
  const city = loc ? `${loc.province ?? ''}${loc.city ?? ''}` : '未知';
  const limit = comp.competitor_limit ?? 0;
  const eventCount = await fetchEventCount(comp.alias);
  const eventStr = eventCount != null ? ` | ${eventCount}个项目` : '';
  const limitStr = limit ? ` | 上限${limit}` : '';
  return {
    // 粗饼仅收中国大陆比赛,国旗恒 🇨🇳。
    title: `比赛公示快讯! ${comp.name}`,
    body: `${dateStr} | ${city}🇨🇳${eventStr}${limitStr}`,
    // 比赛链接指向自有站(alias 去横杠=WCA id);恒落 /zh;alias 缺失时回退 cubing.com。
    url: siteCompUrlFromCubingAlias(comp.alias, undefined, undefined, true) ?? `https://cubing.com${comp.url ?? ''}`,
  };
}

async function runOnce(): Promise<void> {
  const comps = await queryCompetitions();
  if (comps.length === 0) {
    console.warn('[cubing-comp] empty competition list, retry next cycle');
    return;
  }
  const ids = comps.map((c) => String(c.id));

  // 首跑静默吸收:countPushed===0 时记下当前全部 id,不推。
  if ((await countPushed(MONITOR)) === 0) {
    await markPushed(MONITOR, ids);
    console.log(`[cubing-comp] first run, silently absorbed ${ids.length} comps`);
    return;
  }

  const pushed = await getPushedSet(MONITOR, ids);
  const fresh = comps.filter((c) => !pushed.has(String(c.id)));
  if (fresh.length === 0) return;
  console.log(`[cubing-comp] ${fresh.length} new competitions`);

  for (const comp of fresh) {
    const { title, body, url } = await formatCompMessage(comp);
    // 仅推送成功(或 DRY 门)才记账,失败下轮重试。
    if (await sendBark({ title, body, url, group: 'cubing-comp' })) {
      await markPushed(MONITOR, [String(comp.id)]);
    } else {
      console.warn(`[cubing-comp] push failed, will retry: ${comp.name}`);
    }
  }
}

export function startCubingCompMonitor(): void {
  startPoller('cubing-comp', runOnce, POLL_INTERVAL_MS.cubingComp);
}
