/**
 * WCA Live 生涯 PR 监控 —— 移植自 Python wca_pr_detector.py 的 scan_and_push 主路径。
 *
 * 策略:
 *   1. 列今天仍在举办的比赛(competitions(from=今天-3天) + 本地过滤 startDate ≤ today ≤ endDate)
 *   2. 每场拉所有事件/轮次的元数据,挑 active round(!finished && numEnteredResults>0)
 *   3. 每个 active round 拉 results,筛关注选手(watched_persons)的每条 best/average:
 *      - recordTag 非空且 != 'PR' → 是 WR/CR/NR(regional),由 record 监控推,这里只把基线推进、记账,不发
 *      - 否则与 watched_pr_baseline 比基线,破/平 PR → 走 record_format 渲染 Bark 推送
 *
 * 去重:uid = wcalive-pr-<resultId>-<recType>(同 result 的 single/average 各占一个),
 *       monitor_pushed_state 写穿台账;基线推进即"已记账",同值不再触发。
 * 首跑(monitor_pushed_state 该监控 0 行):先 warmBaseline 灌入生涯 PR 基线,再静默吸收当前快照
 *       (只推进基线 + 记账,不发推),否则每个值都像新破 PR。
 */
import { sendBark } from './bark.js';
import { countPushed, getPushedSet, markPushed, type MonitorId } from './state.js';
import { getWatchedWcaIds } from './watched.js';
import { setPr, isNewPr, isTiedPr, warmBaseline } from './pr_baseline.js';
import { POLL_INTERVAL_MS, siteCompUrl } from './config.js';
import { startPoller } from './poll.js';
import { enrichName } from './names.js';
import { formatRecords } from '../routes/wca_format.js';
import type { RecordEvent } from '../utils/record_format.js';

const MONITOR: MonitorId = 'wca_live_pr';
const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

// 注意:competitions(from:) 的变量类型是 `Date`(WCA Live schema 自定义标量),不是 `String`。
const ONGOING_COMPS_QUERY = `
query($from: Date) {
  competitions(from: $from, limit: 100) {
    id name startDate endDate
    venues { country { iso2 } }
  }
}
`;

const COMP_ROUNDS_QUERY = `
query($id: ID!) {
  competition(id: $id) {
    id name wcaId
    venues { country { iso2 } }
    competitionEvents {
      event { id name }
      rounds { id number finished numEnteredResults }
    }
  }
}
`;

const ROUND_RESULTS_QUERY = `
query($id: ID!) {
  round(id: $id) {
    id finished
    results {
      id best average singleRecordTag averageRecordTag
      person { wcaId name country { iso2 name } }
    }
  }
}
`;

// ─── GraphQL 响应类型 ─────────────────────────────────────────────────────────

interface OngoingComp {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  venues: { country: { iso2: string } }[] | null;
}

interface CompMeta {
  id: string;
  name: string | null;
  wcaId: string | null;
  venues: { country: { iso2: string } }[] | null;
  competitionEvents:
    | {
        event: { id: string; name: string } | null;
        rounds: { id: string; number: number | null; finished: boolean; numEnteredResults: number | null }[] | null;
      }[]
    | null;
}

interface RoundResult {
  id: string;
  best: number | null;
  average: number | null;
  singleRecordTag: string | null;
  averageRecordTag: string | null;
  person: {
    wcaId: string | null;
    name: string;
    country: { iso2: string; name: string };
  } | null;
}

type RecType = 'single' | 'average';

interface Candidate {
  resultId: string;
  wcaid: string;
  name: string;
  personIso2: string;
  personCountryEn: string;
  eventId: string;
  eventName: string;
  recType: RecType;
  value: number;
  recordTag: string;
  roundId: string;
  roundNumber: number | null;
  compId: string;
  compWcaId: string | null;
  compName: string;
  compIso2: string;
  tied?: boolean;
}

interface ActiveRound {
  eventId: string;
  eventName: string;
  roundId: string;
  roundNumber: number | null;
}

// ─── GraphQL helper ───────────────────────────────────────────────────────────

/** WCA Live GraphQL POST。15s 超时;非 200 / errors / 超时 → throw(调用方按单元 catch)。 */
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(variables ? { query, variables } : { query }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (j.errors?.length) throw new Error(`GraphQL errors: ${j.errors[0]!.message}`);
    return (j.data ?? {}) as T;
  } finally {
    clearTimeout(t);
  }
}

/** yyyy-mm-dd(本地运行时钟,与 Python date.today().isoformat() 对齐)。 */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── 数据拉取 ─────────────────────────────────────────────────────────────────

/** 列 ongoing 比赛(今天处于 startDate~endDate 区间内)。失败抛出。 */
async function listOngoingComps(lookbackDays = 3): Promise<OngoingComp[]> {
  const today = new Date();
  const todayIso = isoDate(today);
  const from = isoDate(new Date(today.getTime() - lookbackDays * 86400_000));
  const data = await gql<{ competitions: OngoingComp[] | null }>(ONGOING_COMPS_QUERY, { from });
  const comps = data.competitions ?? [];
  return comps.filter(
    (c) => c.startDate && c.endDate && c.startDate <= todayIso && todayIso <= c.endDate,
  );
}

/** 轻量 query:比赛元数据 + 各 round 的 id/finished/numEnteredResults。 */
async function fetchCompRounds(compId: string): Promise<CompMeta> {
  const data = await gql<{ competition: CompMeta | null }>(COMP_ROUNDS_QUERY, { id: compId });
  return data.competition ?? ({ id: compId, name: '', wcaId: null, venues: [], competitionEvents: [] } as CompMeta);
}

/** 拉单个 round 的 results。 */
async function fetchRoundResults(roundId: string): Promise<RoundResult[]> {
  const data = await gql<{ round: { id: string; finished: boolean; results: RoundResult[] | null } | null }>(
    ROUND_RESULTS_QUERY,
    { id: roundId },
  );
  return data.round?.results ?? [];
}

/** 未 finished 且有 result 的 round → {eventId, eventName, roundId}。 */
function activeRounds(meta: CompMeta): ActiveRound[] {
  const out: ActiveRound[] = [];
  for (const ce of meta.competitionEvents ?? []) {
    const event = ce.event;
    if (!event) continue;
    const eventId = event.id;
    const eventName = event.name || eventId;
    for (const r of ce.rounds ?? []) {
      if (r.finished) continue;
      if ((r.numEnteredResults ?? 0) <= 0) continue;
      out.push({ eventId, eventName, roundId: r.id, roundNumber: r.number ?? null });
    }
  }
  return out;
}

/** 从一个 round 的 results 筛关注选手的 single+average,产候选。 */
function candidatesFromRoundResults(
  results: RoundResult[],
  ctx: { compId: string; compWcaId: string | null; compName: string; compIso2: string },
  round: ActiveRound,
  watchedIds: Set<string>,
): Candidate[] {
  const out: Candidate[] = [];
  for (const res of results) {
    const person = res.person;
    const wid = person?.wcaId;
    if (!wid || !watchedIds.has(wid)) continue;
    const country = person!.country ?? { iso2: '', name: '' };
    const pairs: [number, string, RecType][] = [
      [res.best ?? 0, res.singleRecordTag ?? '', 'single'],
      [res.average ?? 0, res.averageRecordTag ?? '', 'average'],
    ];
    for (const [value, recordTag, recType] of pairs) {
      if (value <= 0) continue;
      out.push({
        resultId: res.id,
        wcaid: wid,
        name: person!.name ?? '',
        personIso2: country.iso2 ?? '',
        personCountryEn: country.name ?? '',
        eventId: round.eventId,
        eventName: round.eventName,
        recType,
        value,
        recordTag,
        roundId: round.roundId,
        roundNumber: round.roundNumber,
        compId: ctx.compId,
        compWcaId: ctx.compWcaId,
        compName: ctx.compName,
        compIso2: ctx.compIso2,
      });
    }
  }
  return out;
}

// ─── uid / 分组 ──────────────────────────────────────────────────────────────

/** 已推/已记账标识:同 result.id 的 single + average 各占一个 uid。 */
function prUid(c: Candidate): string {
  return `wcalive-pr-${c.resultId}-${c.recType}`;
}

/** 合并分组:同选手同事件的 single + average 合并为一条推送。 */
function groupKey(c: Candidate): string {
  return `wcalive-pr-${c.wcaid}-${c.eventId}`;
}

/** candidate → RecordEvent(对应 Python _to_format_kwargs)。显式传 tied;不传 previous_pr。 */
async function toFormatEvent(c: Candidate): Promise<RecordEvent> {
  return {
    tag: 'PR',
    rec_type: c.recType,
    attempt_result: c.value,
    event_id: c.eventId,
    event_name: c.eventName,
    person_name: await enrichName(c.name, c.wcaid),
    person_iso2: c.personIso2.toUpperCase(),
    person_country_en: c.personCountryEn,
    comp_name: c.compName,
    comp_iso2: c.compIso2.toUpperCase(),
    tied: c.tied,
    // 比赛链接指向自有站(带 event+round 深链);未关联 WCA id 时回退 WCA Live。
    url:
      siteCompUrl(c.compWcaId, c.eventId, c.roundNumber)
      ?? `https://live.worldcubeassociation.org/competitions/${c.compId}/rounds/${c.roundId}`,
  };
}

// ─── 有界并发(对齐 Python ThreadPoolExecutor max_workers=8)──────────────────

/** items 上限 8 并发跑 fn,失败的项走 onError(log)不打断整体,只收集成功结果。 */
async function mapBounded<I, O>(
  items: I[],
  limit: number,
  fn: (item: I) => Promise<O>,
  onError: (item: I, e: unknown) => void,
): Promise<O[]> {
  const out: O[] = [];
  const queue = [...items];
  async function worker(): Promise<void> {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      try {
        out.push(await fn(item));
      } catch (e) {
        onError(item, e);
      }
    }
  }
  const n = Math.min(limit, queue.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

// ─── 主扫描(对应 Python scan_and_push)──────────────────────────────────────

// 进程级:warmBaseline 每进程只跑一次(对齐 Python 启动时一次性 warm_all)。否则 comp-less 周期
// pushed-state 一直空 → countPushed 恒 0 → 每 60s 重灌 48 人基线 hammer WCA。静默吸收只在
// 「进程首扫 且 历史从未推过」时(对齐 is_pr_first_run = known_pr_ids 空):首扫后不再吸收,新 PR 正常推。
let processWarmed = false;

async function runOnce(): Promise<void> {
  const watchedIds = await getWatchedWcaIds();
  if (watchedIds.size === 0) return;

  let firstRun = false;
  if (!processWarmed) {
    processWarmed = true; // 先置位,防 runOnce 重入重复 warm
    firstRun = (await countPushed(MONITOR)) === 0; // 历史从未推过 → 本次静默吸收当前快照,不发推
    const warmed = await warmBaseline([...watchedIds]);
    console.log(`[wca-live-pr] first scan, warmed ${warmed}/${watchedIds.size} baselines (absorb=${firstRun})`);
  }

  // listOngoingComps 失败 → log + return,下轮重试(对齐 Python:扫失败不当作空)。
  let comps: OngoingComp[];
  try {
    comps = await listOngoingComps();
  } catch (e) {
    console.warn(`[wca-live-pr] list ongoing comps failed: ${(e as Error).message}`);
    return;
  }
  if (comps.length === 0) return;

  // 并发拉 ongoing 比赛元数据(每场失败仅 skip 该场)。
  const metas = await mapBounded(
    comps,
    8,
    (c) => fetchCompRounds(c.id),
    (c, e) => console.warn(`[wca-live-pr] fetch comp meta failed cid=${c.id}: ${(e as Error).message}`),
  );

  // 平铺所有 active round + 比赛上下文。
  const tasks: { ctx: { compId: string; compWcaId: string | null; compName: string; compIso2: string }; round: ActiveRound }[] = [];
  for (const meta of metas) {
    const ctx = {
      compId: meta.id,
      compWcaId: meta.wcaId,
      compName: meta.name ?? '',
      compIso2: meta.venues?.[0]?.country?.iso2 ?? '',
    };
    for (const round of activeRounds(meta)) tasks.push({ ctx, round });
  }
  if (tasks.length === 0) return;

  // 并发拉 results(每个 round 失败仅 skip 该 round),平铺成全部候选。
  const candLists = await mapBounded(
    tasks,
    8,
    async (task) => {
      const results = await fetchRoundResults(task.round.roundId);
      return candidatesFromRoundResults(results, task.ctx, task.round, watchedIds);
    },
    (task, e) =>
      console.warn(`[wca-live-pr] fetch round results failed rid=${task.round.roundId}: ${(e as Error).message}`),
  );
  const allCandidates = candLists.flat();
  if (allCandidates.length === 0) return;

  // 预加载已推台账,跳已处理 uid。
  const allUids = allCandidates.map(prUid);
  const pushedSet = await getPushedSet(MONITOR, allUids);

  // 同时收集:regional record 需推进基线 + 记账(不发推);破/平 PR 入分组。
  const baselineWrites: Candidate[] = [];
  const accountUids: string[] = [];
  const freshByGroup = new Map<string, Candidate[]>();

  for (const cand of allCandidates) {
    const uid = prUid(cand);
    if (pushedSet.has(uid)) continue;

    // recordTag 非空且 != 'PR' → WR/CR/NR,交 record 监控推;这里只把基线推进 + 记账。
    // (WCA Live 也用 singleRecordTag='PR' 标橙色 PR 角标,PR 走本文件,不能当 regional 跳过。)
    if (cand.recordTag && cand.recordTag !== 'PR') {
      baselineWrites.push(cand);
      accountUids.push(uid);
      continue;
    }

    if (!(await isNewPr(cand.wcaid, cand.eventId, cand.recType, cand.value))) continue;

    cand.tied = await isTiedPr(cand.wcaid, cand.eventId, cand.recType, cand.value);
    const k = groupKey(cand);
    let g = freshByGroup.get(k);
    if (!g) {
      g = [];
      freshByGroup.set(k, g);
    }
    g.push(cand);
  }

  // regional record:推进基线 + 记账,不发推。
  for (const cand of baselineWrites) {
    await setPr(cand.wcaid, cand.eventId, cand.recType, cand.value);
  }

  const firstRunAbsorbed: string[] = [];

  for (const group of freshByGroup.values()) {
    // single 在前,average 在后(合并模板期望的顺序)。
    group.sort((a, b) => (a.recType === 'single' ? 0 : 1) - (b.recType === 'single' ? 0 : 1));
    const uids = group.map(prUid);

    if (firstRun) {
      // 首跑静默吸收:推进基线 + 记账,不发推。
      for (const c of group) await setPr(c.wcaid, c.eventId, c.recType, c.value);
      firstRunAbsorbed.push(...uids);
      continue;
    }

    let text: { cn: string; en: string; url: string };
    try {
      const events = await Promise.all(group.map(toFormatEvent));
      text = await formatRecords(events);
    } catch (e) {
      console.error(`[wca-live-pr] format failed for ${uids.join(',')}: ${(e as Error).message}`);
      continue;
    }
    console.log(`[wca-live-pr] new PR${group.length > 1 ? '(merged)' : ''}: ${text.cn}`);

    if (await sendBark({ title: text.cn, body: text.en, url: text.url, group: 'WCA Records', sound: 'multiwayinvitation' })) {
      for (const c of group) await setPr(c.wcaid, c.eventId, c.recType, c.value);
      accountUids.push(...uids);
    } else {
      console.warn(`[wca-live-pr] push failed, will retry: ${uids.join(',')}`);
    }
  }

  // 批量记账:regional + 成功推送的 + 首跑吸收的。
  const toMark = [...accountUids, ...firstRunAbsorbed];
  await markPushed(MONITOR, toMark);
}

export function startWcaLivePrMonitor(): void {
  startPoller('wca-live-pr', runOnce, POLL_INTERVAL_MS.wcaLivePr);
}
