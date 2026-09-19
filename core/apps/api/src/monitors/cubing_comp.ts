/** New competition announcements from the public paginated API. */
import { fetchCubingCompetitions, type CubingCompetition as CubingComp } from '@cuberoot/shared/cubing-live';
import { sendBark } from './bark.js';
import { countPushed, getPushedSet, markPushed, type MonitorId } from './state.js';
import { POLL_INTERVAL_MS, siteCompUrlFromCubingAlias, formatDateRangeIso } from './config.js';
import { startPoller } from './poll.js';

const MONITOR: MonitorId = 'cubing_comp';
const queryCompetitions = fetchCubingCompetitions;

export async function formatCompMessage(comp: CubingComp): Promise<{ title: string; body: string; url: string }> {
  const dateStr = formatDateRangeIso(comp.startDate, comp.endDate ?? comp.startDate);
  const loc = comp.locations?.[0];
  const city = loc?.venueZh || loc?.venue || '未知';
  const limit = comp.competitorLimit || comp.locations.reduce((sum, location) => sum + location.competitorLimit, 0);
  const eventCount = comp.events.length;
  const eventStr = eventCount != null ? ` | ${eventCount}个项目` : '';
  const limitStr = limit ? ` | 上限${limit}` : '';
  return {
    // 粗饼仅收中国大陆比赛,国旗恒 🇨🇳。
    title: `比赛公示快讯! ${comp.nameZh || comp.name}`,
    body: `${dateStr} | ${city}🇨🇳${eventStr}${limitStr}`,
    // WCA 认证赛链接指向自有站(alias 去横杠=WCA id),恒落 /zh;
    // 民间赛(type='other')自有站无该比赛页 → 回退粗饼比赛页 /competition/<alias>。
    url:
      siteCompUrlFromCubingAlias(comp.alias, comp.type, undefined, undefined, true, comp.wcaCompetitionId)
      ?? `https://cubing.com/competition/${comp.alias}`,
  };
}

async function runOnce(): Promise<void> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  // The new endpoint includes historical competitions; never reannounce the archive.
  const comps = (await queryCompetitions()).filter(comp => (comp.endDate ?? comp.startDate) >= today);
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
