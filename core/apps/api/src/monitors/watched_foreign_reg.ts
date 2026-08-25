/**
 * 关注选手「报名国外比赛」监控(issue #34)。
 *
 * 候选集 = all_upcoming_comps.json(1h 缓存)里 country ≠ CN、报名已开放、尚未结束的比赛
 * (~370 场);逐场拉 WCA /api/v0/competitions/:id/registrations(~13KB,只含 accepted,
 * 字段是 user_id 不是 wca_id,故关注表里预解析了 user_id),命中即:
 *   站内通知 + 邮件(utils/notify → admin)+ Bark(受 MONITOR_PUSH_ENABLED 门控)。
 *
 * 去重台账 monitor_pushed_state('foreign_reg', `<compId>:<wcaId>`),重启/重扫不重推。
 * 首跑不静默吸收 —— 已有的国外报名也各通知一次,当上线自验(总量只有个位数)。
 *
 * 独立门控 FOREIGN_REG_WATCH_ENABLED=1(同 result-watch 模式:代码随版本上线但休眠);
 * 间隔 FOREIGN_REG_WATCH_INTERVAL_MS 默认 3h、最短 30min。串行 1.2s 间隔,单场失败跳过,
 * 连续 5 场失败判 WCA 不可用、放弃本轮(下轮整扫自愈)。
 */
import { sendBark } from './bark.js';
import { getPushedSet, markPushed, type MonitorId } from './state.js';
import { siteCompUrl, isChineseRegion, formatDateRangeIso } from './config.js';
import { startPoller } from './poll.js';
import { getUpcomingComps, type UpcomingComp } from '../utils/upcoming_comps_cache.js';
import { notify, adminRecipients } from '../utils/notify.js';

const MONITOR: MonitorId = 'foreign_reg';
const WCA_API = 'https://www.worldcubeassociation.org/api/v0';
const UA: Record<string, string> = { 'User-Agent': 'WCA-Monitor/1.0', Accept: 'application/json' };

const INTERVAL_MS = Math.max(
  30 * 60 * 1000,
  Number(process.env.FOREIGN_REG_WATCH_INTERVAL_MS) || 3 * 60 * 60 * 1000,
);
const STARTUP_DELAY_MS = 180_000; // 与 result-watch(150s)错开,避开进程启动高峰
const REQUEST_GAP_MS = 1200;      // 串行限速,礼貌访问 WCA
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * 关注选手。registrations 端点只回 user_id(WCA 账号 id),不回 wca_id,
 * 故这里预解析写死(来源:/api/v0/search/users?q=<wcaId>)。加人时同步补一条。
 */
const WATCHED: readonly { wcaId: string; userId: number; name: string; nameZh: string }[] = [
  { wcaId: '2023GENG02', userId: 325043, name: 'Xuanyi Geng (耿暄一)', nameZh: '耿暄一' },
  { wcaId: '2019WANY36', userId: 181863, name: 'Yiheng Wang (王艺衡)', nameZh: '王艺衡' },
];

interface WcaRegistration {
  user_id: number;
  event_ids?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 今天(UTC)的 yyyy-mm-dd。比赛 end_date 是赛地本地日期,最多差一天,对报名监控无碍。 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 候选:非中国大陆、报名窗已开、比赛未结束。缺日期字段的保守保留。 */
function isCandidate(c: UpcomingComp, nowIso: string, today: string): boolean {
  if (!c.country || c.country === 'CN') return false;
  if (c.registration_open && c.registration_open > nowIso) return false;
  if (c.end_date && c.end_date < today) return false;
  return true;
}

async function fetchRegistrations(compId: string): Promise<WcaRegistration[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(`${WCA_API}/competitions/${encodeURIComponent(compId)}/registrations`, {
      headers: UA, signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as unknown;
    return Array.isArray(j) ? (j as WcaRegistration[]) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function reportHit(
  person: (typeof WATCHED)[number],
  comp: UpcomingComp,
  events: string[],
): Promise<boolean> {
  const dates = comp.start_date ? formatDateRangeIso(comp.start_date, comp.end_date) : '';
  const place = [comp.city, comp.country].filter(Boolean).join(', ');
  const detail = [dates, place, events.join(' ')].filter(Boolean).join(' | ');
  const link = `/wca/comp/${comp.id}`;

  // 站内通知 + 邮件是主路径:失败(DB 挂)则不 markPushed,下轮重试。
  try {
    await notify({
      recipients: adminRecipients(),
      kind: 'comp_reg',
      actorKey: person.wcaId,
      actorName: person.name,
      title: comp.name,
      excerpt: detail,
      link,
    });
  } catch (e) {
    console.warn(`[foreign-reg] notify failed for ${person.wcaId} @ ${comp.id}:`, (e as Error).message);
    return false;
  }

  // Bark 旁路(门控内 DRY):失败只记日志,不回滚站内通知,也不重推(防重复邮件)。
  await sendBark({
    title: `${person.nameZh} 报名国外比赛`,
    body: `${comp.name} | ${detail}`,
    url: siteCompUrl(comp.id, undefined, undefined, isChineseRegion(comp.country))
      ?? `https://www.worldcubeassociation.org/competitions/${comp.id}`,
    group: 'foreign-reg',
  });
  return true;
}

async function runOnce(): Promise<void> {
  let comps: UpcomingComp[];
  try {
    comps = await getUpcomingComps();
  } catch (e) {
    console.warn('[foreign-reg] upcoming comps unavailable, skip cycle:', (e as Error).message);
    return;
  }
  const nowIso = new Date().toISOString();
  const today = todayIso();
  const candidates = comps.filter((c) => isCandidate(c, nowIso, today));
  if (candidates.length === 0) return;

  // 已推台账整批预取(uid = compId:wcaId),扫描中命中直接查内存
  const allUids = candidates.flatMap((c) => WATCHED.map((p) => `${c.id}:${p.wcaId}`));
  const pushed = await getPushedSet(MONITOR, allUids);

  console.log(`[foreign-reg] sweeping ${candidates.length} non-CN comps`);
  let failures = 0;
  let hits = 0;
  for (const comp of candidates) {
    const regs = await fetchRegistrations(comp.id);
    if (regs === null) {
      failures += 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`[foreign-reg] ${failures} consecutive failures, aborting sweep`);
        return;
      }
      await sleep(REQUEST_GAP_MS);
      continue;
    }
    failures = 0;
    for (const person of WATCHED) {
      const uid = `${comp.id}:${person.wcaId}`;
      if (pushed.has(uid)) continue;
      const reg = regs.find((r) => r.user_id === person.userId);
      if (!reg) continue;
      if (await reportHit(person, comp, reg.event_ids ?? [])) {
        await markPushed(MONITOR, [uid]);
        pushed.add(uid);
        hits += 1;
      }
    }
    await sleep(REQUEST_GAP_MS);
  }
  if (hits > 0) console.log(`[foreign-reg] ${hits} new foreign registration(s) reported`);
}

export function startWatchedForeignRegMonitor(): void {
  if (process.env.FOREIGN_REG_WATCH_ENABLED !== '1') {
    console.log('[foreign-reg] disabled (set FOREIGN_REG_WATCH_ENABLED=1 to start)');
    return;
  }
  console.log(`[foreign-reg] starting in ${STARTUP_DELAY_MS / 1000}s, interval ${INTERVAL_MS / 60000}min`);
  setTimeout(() => startPoller('foreign-reg', runOnce, INTERVAL_MS), STARTUP_DELAY_MS);
}
