/** Poll public REST rounds; preserve record and watched-person PR deduplication. */
import { fetchCubingCompetitions, fetchCubingJson, normalizeCubingRound, type CubingCompetition as CubingComp, type CubingRound, type CubingResult } from '@cuberoot/shared/cubing-live';
import { fetchCubingMeta } from '../utils/cubing_live.js';
import { sendBark } from './bark.js';
import { getPushedSet, markPushed, type MonitorId } from './state.js';
import { RECORD_TAGS, NR_COUNTRIES, POLL_INTERVAL_MS, siteCompUrlFromCubingAlias, isChineseRegion } from './config.js';
import { COUNTRY_EN_MAP, isContinentalTag } from './region.js';
import { getWatchedMatchKeys } from './watched.js';
import { startPoller } from './poll.js';
import { EVENT_NAME_BY_ID, type RecordEvent } from '../utils/record_format.js';
import { formatRecords } from '../routes/wca_format.js';
import { enrichRecordTags, type CompData } from '../routes/cubing_live.js';

const MONITOR: MonitorId = 'cubing_record';
const WINDOW_DAYS = 30;

interface WsUser {
  name?: string;
  wcaid?: string;
  region?: string;
}

// result row(实测):i:result-id n:competitor# e:event r:round b:best(cs) a:average(cs)
// sr:"WR"/"AsR"/... ar:同上(平均)
interface LiveRow {
  i: number;
  n: number;
  e: string;
  r: string;
  b?: number | null;
  a?: number | null;
  sr?: string;
  ar?: string | number;
}

interface InternalEvent {
  uid: string;
  groupKey: string;
  tag: string;
  recType: 'single' | 'average';
  attemptResult: number;
  eventId: string;
  roundId: string;
  roundNumber?: number; // 本站 1-based 轮次序号(深链 ?round=N);缺失时链接只带 event
  personName: string;
  personRegion: string;
  compIso2: string;
  compName: string;
  compNameEn: string;
  slug: string;
  /** 粗饼 type 字段;非 'WCA' 的民间赛没有自有站比赛页,链接留在粗饼 live。 */
  compType?: string;
  wcaCompetitionId?: string;
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

const listCompetitions = fetchCubingCompetitions;

export function isChinaInWindow(comp: CubingComp, now: number, windowSeconds: number): boolean {
  if (!comp.live || !comp.locations.some(location => ['CN', 'HK', 'MO', 'TW'].includes(location.regionIso2))) return false;
  const start = Date.parse(comp.startDate + 'T00:00:00+08:00') / 1000;
  return now - windowSeconds <= start && start <= now + 86400;
}

function compIso2(comp: CubingComp): string {
  return comp.locations[0]?.regionIso2 ?? '';
}

// result.user 的 nb/na 行(破生涯 PR 标记)。schema 与 LiveRow 近似,额外带 _event/_wcaid/_name/_region。
interface PrRow {
  i: number;          // result id
  n?: number;         // competitor number
  e?: string;         // event id 字符串 "333"
  r?: string;         // round id
  b?: number | null;
  a?: number | null;
  nb?: boolean;       // 破单次生涯 PR
  na?: boolean;       // 破平均生涯 PR
  sr?: string;
  ar?: string | number;
  _event?: string | number | null;
  _wcaid: string;
  _name: string;
  _region?: string;
}

/** A regional record is also a personal record upstream. Keep the stronger adjudicated label only. */
export function suppressAdjudicatedRecordPrs(prRows: PrRow[], adjudicatedRows: LiveRow[]): void {
  const byId = new Map(adjudicatedRows.map(row => [row.i, row]));
  for (const row of prRows) {
    const adjudicated = byId.get(row.i);
    if (adjudicated?.sr) row.nb = false;
    if (adjudicated?.ar) row.na = false;
  }
}


/** cubing.com user.name → 选手 key(优先括号内中文名,否则原名)。等价 Python _match_key。 */
function matchKey(name: string): string {
  const m = (name || '').match(/\(([^)]+)\)/);
  return (m ? m[1] : name || '').trim();
}

// ─── 纪录检测 ───────────────────────────────────────────────────────────────

/** 遍历一场比赛的所有 result row,产出可推送的内部 event。
 *  每条 sr / ar 标记一个 event;同 row 的两条共享 groupKey,后续可合并推送。 */
function iterRecordEvents(rows: LiveRow[], users: Record<number, WsUser>, comp: CubingComp, roundNumByKey: Map<string, number>): InternalEvent[] {
  const cIso2 = compIso2(comp);
  const compName = comp.nameZh || comp.name || comp.alias || '';
  const compNameEn = comp.name || comp.alias || '';
  const slug = comp.alias || '';
  const out: InternalEvent[] = [];

  for (const row of rows) {
    const fields: [string, 'single' | 'average', number | null | undefined][] = [
      ['sr', 'single', row.b],
      ['ar', 'average', row.a],
    ];
    for (const [field, recType, value] of fields) {
      const tagRaw = field === 'sr' ? row.sr : row.ar;
      const tag = (tagRaw || '') as string;
      if (!tag) continue;
      // 纪录但成绩 DNF/缺失 — 不应该出现,跳过
      if (value == null || value <= 0) continue;
      const user = users[row.n];
      if (!user) continue;
      out.push({
        uid: `cubing-${row.i}-${field}`,
        groupKey: `cubing-row-${row.i}`,
        tag,
        recType,
        attemptResult: value,
        eventId: row.e,
        roundId: row.r,
        roundNumber: roundNumByKey.get(`${row.e}|${row.r}`),
        personName: user.name || '',
        personRegion: user.region || '',
        compIso2: cIso2,
        compName,
        compNameEn,
        slug,
        compType: comp.type,
        wcaCompetitionId: comp.wcaCompetitionId,
      });
    }
  }
  return out;
}

/** result.user 的 nb/na rows → PR 内部 event(对应 Python iter_pr_events)。
 *  按 (wcaid, eventId, recType) 去重取最快;同选手同事件 single+avg 共享 groupKey 合并推送。 */
function iterPrEvents(prRows: PrRow[], comp: CubingComp, roundNumByKey: Map<string, number>): InternalEvent[] {
  const cIso2 = compIso2(comp);
  const compName = comp.nameZh || comp.name || comp.alias || '';
  const compNameEn = comp.name || comp.alias || '';
  const slug = comp.alias || '';

  // (wcaid|eventId|recType) → 最快的那条
  const best = new Map<string, { row: PrRow; value: number }>();
  for (const row of prRows) {
    const wcaid = row._wcaid || '';
    // r.e 优先(字符串 "333");否则 fallback str(_event)
    const eventId = row.e || String(row._event ?? '');
    const kinds: [keyof PrRow, 'single' | 'average', number | null | undefined][] = [
      ['nb', 'single', row.b],
      ['na', 'average', row.a],
    ];
    for (const [flag, recType, v] of kinds) {
      if (!row[flag]) continue;
      if (v == null || v <= 0) continue;
      const k = `${wcaid}|${eventId}|${recType}`;
      const cur = best.get(k);
      if (!cur || v < cur.value) best.set(k, { row, value: v });
    }
  }

  const out: InternalEvent[] = [];
  for (const [k, { row, value }] of best) {
    if (!row.i) continue;
    const [wcaid, eventId, recType] = k.split('|') as [string, string, 'single' | 'average'];
    const field = recType === 'single' ? 'nb' : 'na';
    out.push({
      uid: `cubing-${row.i}-${field}`,
      groupKey: `cubing-pr-${wcaid}-${eventId}`,
      tag: 'PR',
      recType,
      attemptResult: value,
      eventId,
      roundId: row.r || '',
      roundNumber: roundNumByKey.get(`${eventId}|${row.r || ''}`),
      personName: row._name || '',
      personRegion: row._region || 'China',
      compIso2: cIso2,
      compName,
      compNameEn,
      slug,
      compType: comp.type,
      wcaCompetitionId: comp.wcaCompetitionId,
    });
  }
  return out;
}

/** 扫描单场比赛,返回所有 record + PR 事件。 */
export async function scanComp(comp: CubingComp, watchedKeys: Set<string>): Promise<InternalEvent[]> {
  const meta = await fetchCubingMeta(comp.alias);
  const users: CompData['users'] = {};
  const rows: LiveRow[] = [];
  const prRows: PrRow[] = [];
  const resultsByRound: CompData['resultsByRound'] = {};
  const roundNumByKey = new Map<string, number>();
  for (const event of meta.events) {
    for (const round of event.rs) {
      const number = Number(round.liveId);
      const payload = await fetchCubingJson<{ round: CubingRound; results: CubingResult[] }>(comp.alias,
        '/live/results/' + encodeURIComponent(event.i) + '/' + number);
      if (payload.round.competitionId !== comp.id || payload.round.eventId !== event.i || payload.round.roundNumber !== number) {
        throw new Error('Mismatched cubing.com monitor round');
      }
      const snapshot = normalizeCubingRound(payload, round.i);
      Object.assign(users, snapshot.users);
      rows.push(...snapshot.results);
      resultsByRound[`${event.i}:${round.i}`] = structuredClone(snapshot.results);
      roundNumByKey.set(event.i + '|' + round.i, number);
      for (let index = 0; index < payload.results.length; index++) {
        const raw = payload.results[index]!;
        const row = snapshot.results[index]!;
        const user = snapshot.users[String(row.n)]!;
        if (!user.wcaid || !watchedKeys.has(matchKey(user.name))) continue;
        if (raw.personalSingleRecord === 'PR' || raw.personalAverageRecord === 'PR') {
          prRows.push({ ...row, nb: raw.personalSingleRecord === 'PR' && !row.sr, na: raw.personalAverageRecord === 'PR' && !row.ar,
            _wcaid: user.wcaid, _name: user.name, _region: user.region });
        }
      }
    }
  }
  if (prRows.length > 0) {
    const adjudicated: CompData = {
      slug: comp.wcaCompetitionId || comp.alias.replace(/-/g, ''),
      cubingSlug: comp.alias,
      source: 'cubing',
      compId: meta.compId,
      name: meta.name,
      type: meta.type,
      events: meta.events,
      users,
      resultsByRound,
      membersByFilter: {
        females: Object.values(users).filter(user => user.gender === 'f').map(user => user.number),
        children: [],
        newcomers: Object.values(users).filter(user => !user.wcaid).map(user => user.number),
      },
      fetchedAt: Date.now(),
    };
    await enrichRecordTags(adjudicated);
    suppressAdjudicatedRecordPrs(prRows, Object.values(adjudicated.resultsByRound).flat());
  }
  return [...iterRecordEvents(rows, users, comp, roundNumByKey), ...iterPrEvents(prRows, comp, roundNumByKey)];
}

// ─── 过滤 + 聚合 + 推送 ─────────────────────────────────────────────────────

/** 内部 event → RecordEvent(供 formatRecords)。 */
function toRecordEvent(ev: InternalEvent): RecordEvent {
  return {
    tag: ev.tag,
    rec_type: ev.recType,
    attempt_result: ev.attemptResult,
    event_id: ev.eventId,
    event_name: EVENT_NAME_BY_ID[ev.eventId] || ev.eventId,
    person_name: ev.personName,
    person_iso2: COUNTRY_EN_MAP[ev.personRegion] || (/^[A-Z]{2}$/.test(ev.personRegion) ? ev.personRegion : ''),
    person_country_en: ev.personRegion,
    comp_name: ev.compName,
    comp_name_en: ev.compNameEn,
    comp_iso2: ev.compIso2,
    // WCA 认证赛链接指向自有站(alias 去横杠=WCA id),带 event + 本站轮次序号深链。
    // roundNumber 由 data-events 里 rs 的位置推出(cubing 的 roundId 非序号);
    // 中国比赛落 /zh;alias 缺失 / 民间赛(type≠'WCA',自有站无该比赛页)回退 cubing.com live 页。
    url:
      siteCompUrlFromCubingAlias(ev.slug, ev.compType, ev.eventId, ev.roundNumber ?? null, isChineseRegion(ev.compIso2), ev.wcaCompetitionId)
      ?? `https://cubing.com/competition/${ev.slug}/live?eventId=${encodeURIComponent(ev.eventId)}&roundNumber=${ev.roundNumber ?? 1}`,
  };
}

/** tag 过滤:RECORD_TAGS 精确匹配;洲缩写命中 RECORD_TAGS 含 'CR' 时通配;NR 走国家白名单。
 *  PR 一律跳过(Phase 4)。 */
function wanted(ev: InternalEvent): boolean {
  const tag = ev.tag;
  // PR 已被 watchedKeys 过滤,无条件放行(对齐 Python _wanted: if tag=='PR': return True)。
  if (tag === 'PR') return true;
  if (!(RECORD_TAGS.has(tag) || (isContinentalTag(tag) && RECORD_TAGS.has('CR')))) return false;
  if (tag === 'NR' && NR_COUNTRIES.size > 0) {
    const personIso2 = COUNTRY_EN_MAP[ev.personRegion] || (/^[A-Z]{2}$/.test(ev.personRegion) ? ev.personRegion : '');
    if (!NR_COUNTRIES.has(personIso2)) return false;
  }
  return true;
}

/** 对一批纪录事件过滤 + 按 groupKey 聚合 + 推送。无首跑静默吸收(未 known 全推)。 */
async function processEvents(events: InternalEvent[]): Promise<void> {
  const candidates = events.filter(wanted);
  if (candidates.length === 0) return;

  const pushed = await getPushedSet(MONITOR, candidates.map((e) => e.uid));
  const fresh = candidates.filter((e) => !pushed.has(e.uid));
  if (fresh.length === 0) return;

  // 按 groupKey 聚合(同一 row 的 sr+ar 落到同一组),组内 single 先。
  const groups = new Map<string, InternalEvent[]>();
  for (const ev of fresh) {
    let arr = groups.get(ev.groupKey);
    if (!arr) { arr = []; groups.set(ev.groupKey, arr); }
    arr.push(ev);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => (a.recType === 'single' ? 0 : 1) - (b.recType === 'single' ? 0 : 1));
    const uids = group.map((e) => e.uid);
    try {
      const { cn, en, url } = await formatRecords(group.map(toRecordEvent));
      console.log(`[cubing-record] 🆕 新纪录${group.length > 1 ? '(合并)' : ''}: ${cn}`);
      if (await sendBark({ title: cn, body: en, url, group: 'WCA Records', sound: 'multiwayinvitation' })) {
        await markPushed(MONITOR, uids);
      } else {
        console.warn(`[cubing-record] push failed, will retry: ${uids.join(',')}`);
      }
    } catch (e) {
      console.warn(`[cubing-record] format/push error for ${uids.join(',')}: ${(e as Error).message}`);
    }
  }
}

// ─── 主循环 ─────────────────────────────────────────────────────────────────

/** 单次扫描全部目标比赛(REST 轮次,串行)。每场错误捕获后跳过,不让整轮崩。 */
async function runOnce(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  let comps: CubingComp[];
  try {
    comps = await listCompetitions();
  } catch (e) {
    console.warn(`[cubing-record] list competitions failed: ${(e as Error).message}`);
    return;
  }
  const windowSec = WINDOW_DAYS * 86400;
  const targets = comps.filter((c) => isChinaInWindow(c, now, windowSec));
  console.log(`[cubing-record] CN comps in last ${WINDOW_DAYS} days: ${targets.length}`);

  // 关注选手 key(PR 监控用),空则相 2 跳过。每轮取一次(watched.ts 内有 60s 缓存)。
  const watchedKeys = await getWatchedMatchKeys();

  for (const comp of targets) {
    try {
      const events = await scanComp(comp, watchedKeys);
      if (events.length > 0) console.log(`[cubing-record] ${comp.alias}: ${events.length} record events`);
      await processEvents(events);
    } catch (e) {
      console.warn(`[cubing-record] scan comp ${comp.alias} failed: ${(e as Error).message}`);
    }
  }
}

export function startCubingRecordMonitor(): void {
  startPoller('cubing-record', runOnce, POLL_INTERVAL_MS.cubingRecord);
}
