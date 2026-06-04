/**
 * WCA Live 纪录监控 —— 移植自 Python wca_record_monitor.py 的 RECORD 主路径。
 * 轮询 WCA Live GraphQL recentRecords,过滤 WR/CR/NR(NR 再过国家白名单),
 * diff 已推 id,同 round 同选手的单次/平均合并成一条,走 record_format 渲染后 Bark 推送。
 *
 * 仅纪录检测路径。关注选手 PR 扫描(scan_pr / watched_ids / pr_cache)是 Phase 4,本文件不实现。
 * 邮件(Python WR 发邮件)整块跳过 —— 邮件是留在 Python 的本地工具,不在本移植范围。
 */
import { sendBark } from './bark.js';
import { countPushed, getPushedSet, markPushed, type MonitorId } from './state.js';
import { RECORD_TAGS, NR_COUNTRIES, POLL_INTERVAL_MS } from './config.js';
import { startPoller } from './poll.js';
import { enrichName } from './names.js';
import { formatRecords } from '../routes/wca_format.js';
import type { RecordEvent } from '../utils/record_format.js';

const MONITOR: MonitorId = 'wca_live_record';
const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

// GraphQL 查询:近期纪录 + 选手/比赛/项目/轮次。round { id } 必须有 —— 同 round 聚合 key 用它。
// 结构与 Python RECORDS_QUERY 1:1(round 嵌在 result 下,这是 WCA Live 真实 schema 形态)。
const RECORDS_QUERY = `
{
  recentRecords {
    id
    tag
    type
    attemptResult
    result {
      person {
        name
        wcaId
        country {
          name
          iso2
        }
      }
      round {
        id
        name
        competitionEvent {
          event {
            id
            name
          }
          competition {
            id
            name
            venues {
              country {
                iso2
              }
            }
          }
        }
      }
    }
  }
}
`;

// ─── GraphQL 响应类型 ─────────────────────────────────────────────────────────

interface RecentRecord {
  id: string;
  tag: string;
  type: string; // 'single' | 'average'
  attemptResult: number;
  result: {
    person: {
      name: string;
      wcaId: string | null;
      country: { name: string; iso2: string };
    };
    round: {
      id: string;
      name: string;
      competitionEvent: {
        event: { id: string; name: string };
        competition: {
          id: string;
          name: string;
          venues: { country: { iso2: string } }[];
        };
      };
    };
  };
}

/** 查询 WCA Live 近期纪录列表。非 200 / errors / 超时 → 返 null 让本轮跳过、下轮重试。 */
async function queryRecentRecords(): Promise<RecentRecord[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: RECORDS_QUERY }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[wca-live-record] API returned ${res.status}`);
      return null;
    }
    const j = (await res.json()) as {
      data?: { recentRecords?: RecentRecord[] };
      errors?: { message: string }[];
    };
    if (j.errors?.length) {
      console.warn(`[wca-live-record] GraphQL error: ${j.errors[0].message}`);
      return null;
    }
    return j.data?.recentRecords ?? [];
  } catch (e) {
    console.warn(`[wca-live-record] request failed: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** 合并 key:同 round + 同选手(无 wcaId 退回英文名)。等价 Python _group_key。 */
function groupKey(r: RecentRecord): string {
  const rid = r.result.round.id;
  const person = r.result.person;
  return `${rid}|${person.wcaId || person.name}`;
}

/** 单条 GraphQL record → RecordEvent(对应 Python _record_to_kwargs)。 */
async function recordToEvent(r: RecentRecord): Promise<RecordEvent> {
  const { person, round } = r.result;
  const ev = round.competitionEvent.event;
  const competition = round.competitionEvent.competition;
  const venues = competition.venues ?? [];
  const compIso2 = (venues[0]?.country?.iso2 || person.country.iso2).toUpperCase();
  return {
    tag: r.tag,
    rec_type: r.type,
    attempt_result: r.attemptResult,
    event_id: ev.id,
    event_name: ev.name,
    // WCA Live 只给英文名,补本地名升级成 "Eng (本地)" 供 record_format 拆中文。
    person_name: await enrichName(person.name, person.wcaId),
    person_iso2: person.country.iso2.toUpperCase(),
    person_country_en: person.country.name,
    // Python 推的是英文比赛名(中文比赛名是后续可选项,先保持 parity)。
    comp_name: competition.name,
    comp_name_en: competition.name,
    comp_iso2: compIso2,
    url: `https://live.worldcubeassociation.org/competitions/${competition.id}/rounds/${round.id}`,
  };
}

async function runOnce(): Promise<void> {
  const records = await queryRecentRecords();
  if (records === null) return;

  // 过滤:tag 在 RECORD_TAGS 内;NR 且白名单非空时,只留白名单国家。
  const filtered = records.filter((r) => {
    if (!RECORD_TAGS.has(r.tag)) return false;
    if (r.tag === 'NR' && NR_COUNTRIES.size > 0) {
      return NR_COUNTRIES.has(r.result.person.country.iso2);
    }
    return true;
  });

  const ids = filtered.map((r) => r.id);

  // 首跑静默吸收当前快照(对齐 Python is_first_run),不推送。
  if ((await countPushed(MONITOR)) === 0) {
    await markPushed(MONITOR, ids);
    console.log(`[wca-live-record] first run, silently absorbed ${ids.length} records`);
    return;
  }

  const pushed = await getPushedSet(MONITOR, ids);
  const fresh = filtered.filter((r) => !pushed.has(r.id));
  if (fresh.length === 0) return;

  // 按 (round, person) 聚合 → 同组单次/平均合并成一条推送。
  const groups = new Map<string, RecentRecord[]>();
  for (const r of fresh) {
    const k = groupKey(r);
    let g = groups.get(k);
    if (!g) {
      g = [];
      groups.set(k, g);
    }
    g.push(r);
  }

  for (const group of groups.values()) {
    // 同组稳定排序:single 在前,average 在后(对齐 Python)。
    group.sort((a, b) => (a.type === 'single' ? 0 : 1) - (b.type === 'single' ? 0 : 1));
    const rids = group.map((r) => r.id);

    let text: { cn: string; en: string; url: string };
    try {
      const events = await Promise.all(group.map(recordToEvent));
      text = await formatRecords(events);
    } catch (e) {
      console.error(`[wca-live-record] format failed for ${rids.join(',')}:`, (e as Error).message);
      continue;
    }
    console.log(`[wca-live-record] new record${group.length > 1 ? '(merged)' : ''}: ${text.cn}`);

    // 标题=中文,正文=英文(Python send_bark_notification 约定);推成功才标记已推,失败下轮重试。
    if (await sendBark({ title: text.cn, body: text.en, url: text.url, group: 'WCA Records', sound: 'multiwayinvitation' })) {
      await markPushed(MONITOR, rids);
    } else {
      console.warn(`[wca-live-record] push failed, will retry: ${rids.join(',')}`);
    }
    // Phase 4: Python 在此交错扫描关注选手 PR(scan_pr),本移植跳过。
  }
}

export function startWcaLiveRecordMonitor(): void {
  startPoller('wca-live-record', runOnce, POLL_INTERVAL_MS.wcaLiveRecord);
}
