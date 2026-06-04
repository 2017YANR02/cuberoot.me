/**
 * WCA 官方新比赛监控 —— 移植自 wca_comp_monitor.py。
 * 轮询 WCA REST /competitions?sort=-announced_at,diff 已推 comp id,新比赛 Bark(group wca-comp)。
 * 与粗饼监控(中国大陆)互补:本监控全球覆盖。emoji 与旧 Python 逐字一致。
 */
import { sendBark } from './bark.js';
import { countPushed, getPushedSet, markPushed, type MonitorId } from './state.js';
import { POLL_INTERVAL_MS } from './config.js';
import { startPoller } from './poll.js';

const MONITOR: MonitorId = 'wca_comp';
const WCA_API = 'https://www.worldcubeassociation.org/api/v0/competitions';
const UA: Record<string, string> = { 'User-Agent': 'WCA-Monitor/1.0', Accept: 'application/json' };
// per_page=50 在 WCA /competitions?sort=-announced_at 服务端很重(实测 ~20-26s,并发拥塞时 >45s 被 abort);
// per_page=10 仅 ~2s。60s 轮询不可能漏(一轮内不会公示 10 个新赛)。
const PER_PAGE = 10;

interface WcaComp {
  id: string;
  name: string;
  date_range?: string;
  start_date?: string;
  city?: string;
  country_iso2?: string;
  event_ids?: string[];
  competitor_limit?: number | null;
  announced_at?: string;
  url?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ISO2 → emoji 国旗(Regional Indicator),移植 monitor_utils.country_flag。 */
function countryFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '';
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
}

async function queryCompetitions(): Promise<WcaComp[]> {
  const url = `${WCA_API}?sort=-announced_at&per_page=${PER_PAGE}`;
  // per_page=10 后单次 ~3.8s。进程内偶发争用会让某次 >15s 被 abort,保留 3 次当轮重试自愈
  // (每次都快,poll-guard 兜底不与下轮重叠);3 次仍失败再靠 60s 轮询补。
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    // per_page=10 后该查询 ~2s,15s 超时足够;失败靠 60s 轮询补(poll-guard 兜底不重叠)。
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(url, { headers: UA, signal: ctrl.signal });
      if (r.ok) {
        const text = await r.text();
        if (text.trim()) return JSON.parse(text) as WcaComp[];
      }
      console.warn(`[wca-comp] API returned ${r.status}, retry ${attempt + 1}/3`);
    } catch (e) {
      console.warn(`[wca-comp] request failed: ${(e as Error).message}, retry ${attempt + 1}/3`);
    } finally {
      clearTimeout(t);
    }
    await sleep(3000);
  }
  return [];
}

function formatCompMessage(comp: WcaComp): { title: string; body: string; url: string } {
  const dateRange = comp.date_range ?? comp.start_date ?? '';
  const city = comp.city ?? '';
  const flag = countryFlag(comp.country_iso2 ?? '');
  const eventCount = (comp.event_ids ?? []).length;
  const limit = comp.competitor_limit;
  const limitStr = limit ? ` | 👥 上限${limit}` : '';
  return {
    title: `🌍WCA新赛! ${comp.name}`,
    body: `📅 ${dateRange} | 📍 ${city} ${flag} | 🏷️ ${eventCount}个项目${limitStr}`,
    url: comp.url ?? `https://www.worldcubeassociation.org/competitions/${comp.id}`,
  };
}

async function runOnce(): Promise<void> {
  const comps = await queryCompetitions();
  if (comps.length === 0) {
    console.warn('[wca-comp] empty competition list, retry next cycle');
    return;
  }
  const ids = comps.map((c) => c.id);

  if ((await countPushed(MONITOR)) === 0) {
    await markPushed(MONITOR, ids);
    console.log(`[wca-comp] first run, silently absorbed ${ids.length} comps`);
    return;
  }

  const pushed = await getPushedSet(MONITOR, ids);
  // 按 announced_at 升序,最早公布的先推(对齐旧 Python)。
  const fresh = comps
    .filter((c) => !pushed.has(c.id))
    .sort((a, b) => (a.announced_at ?? '').localeCompare(b.announced_at ?? ''));
  if (fresh.length === 0) return;
  console.log(`[wca-comp] ${fresh.length} new WCA competitions`);

  for (const comp of fresh) {
    const { title, body, url } = formatCompMessage(comp);
    if (await sendBark({ title, body, url, group: 'wca-comp' })) {
      await markPushed(MONITOR, [comp.id]);
    } else {
      console.warn(`[wca-comp] push failed, will retry: ${comp.name}`);
    }
  }
}

export function startWcaCompMonitor(): void {
  startPoller('wca-comp', runOnce, POLL_INTERVAL_MS.wcaComp);
}
