/**
 * 关注选手「往期成绩变更」监控 —— 与其余 5 个实时监控不同,这是慢周期(默认 6h)的
 * 全生涯成绩快照 diff。每位 watched_persons 拉一次 WCA 公共 API 的全生涯成绩
 * (/api/v0/persons/:id/results),与 PG 里上次快照逐条比对,检出:
 *   - removed   整条成绩消失(成绩取消 / 比赛成绩被撤回)
 *   - modified  某条成绩字段变了(成绩值 / 名次 / 单步 / 纪录标记被修正)
 * 检出的变更写入 wca_result_changes(append-only),供 /wca/result-watch 页只读;
 * 每位选手若本轮有变更,额外推一条 Bark 汇总(best-effort,同 MONITOR_PUSH_ENABLED 门)。
 *
 * 设计:
 *   - 不报「新增 added」:正常参赛产生的新成绩不是「往期成绩更改」,只会刷屏。
 *   - 快照即去重:更新快照后同一变更不再被检出,无需 monitor_pushed_state。
 *   - 首跑(该选手无快照):静默吸收当前快照,不记变更、不推。
 *   - 服务器出口 IP 未被 WCA 封(只有 GH runner 段被封),直连 WCA 公共 API。
 *   - content_hash 整体未变 → 跳过 diff/写入,只刷新 checked_at。
 */
import { createHash } from 'node:crypto';
import { query } from '../db/connection.js';
import { getWatchedPersons } from './watched.js';
import { sendBark } from './bark.js';
import { startPoller } from './poll.js';
import { isChineseRegion } from './config.js';

const WCA_API = 'https://www.worldcubeassociation.org/api/v0';
const SITE_BASE = 'https://www.cuberoot.me';
const FETCH_TIMEOUT_MS = 20_000;
// WCA(Cloudflare 后)对突发并发返 500/429:单请求 200,48 人并发 burst 大面积 500。
// 故串行 + 请求间隔 + 退避重试;一次只打 1 个 /results(name/iso2 从 results 行直接取,不再单独拉 profile)。
const CONCURRENCY = 1;
const REQUEST_GAP_MS = 1500;          // 每人之间的礼貌间隔
const RETRY_BACKOFF_MS = [4000, 12000]; // 单条 500/429/网络错的退避(共 2 次重试)
// 熔断:连续 N 人失败 = WCA 在惩罚本机 IP(突发后的冷却窗),立即中止本轮,
// 别在惩罚期继续打(只会延长冷却);下个 6h 周期再试,届时 IP 已恢复。
const MAX_CONSECUTIVE_FAILURES = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 默认 6h;可经 env 调。最短 30min 兜底,防误配狂打 WCA。 */
const INTERVAL_MS = Math.max(
  30 * 60_000,
  Number(process.env.MONITOR_PAST_RESULTS_INTERVAL_MS) || 6 * 60 * 60_000,
);

/** 成绩指纹 —— 仅含会因更正 / 取消而变动的字段(c/e/r/f 是身份,不参与 diff)。 */
interface Fp {
  c: string;          // competition_id
  e: string;          // event_id
  r: string;          // round_type_id
  f: string;          // format_id
  b: number;          // best
  a: number;          // average
  p: number;          // pos
  at: number[];       // attempts
  rs: string | null;  // regional_single_record
  ra: string | null;  // regional_average_record
}

type FpMap = Record<string, Fp>;

interface RawResult {
  id: number;
  name?: string;
  country_iso2?: string;
  competition_id: string;
  event_id: string;
  round_type_id: string;
  format_id: string;
  best: number;
  average: number;
  pos: number;
  attempts: number[];
  regional_single_record?: string | null;
  regional_average_record?: string | null;
}

interface ChangeField { field: string; old: unknown; new: unknown }

interface DetectedChange {
  resultId: number;
  competitionId: string;
  eventId: string;
  roundTypeId: string;
  changeType: 'removed' | 'modified';
  fields: ChangeField[] | null;
  before: Fp | null;
  after: Fp | null;
}

// ── WCA fetch ────────────────────────────────────────────────────────────────

/** 带退避重试的 WCA GET:500 / 429 / 503 / 网络错 → 退避后重试(RETRY_BACKOFF_MS 次)。 */
async function wcaJson<T>(url: string): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'cuberoot-result-watch/1.0' },
        signal: ctrl.signal,
      });
      if (res.status === 500 || res.status === 429 || res.status === 503) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // 4xx(非 429)= 永久错,但仍走重试上限后抛
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e as Error;
      const backoff = RETRY_BACKOFF_MS[attempt];
      if (backoff === undefined) break; // 重试用尽
      await sleep(backoff);
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr ?? new Error('fetch failed');
}

/**
 * 拉某选手全生涯成绩 → fingerprint 映射(key = result.id) + 选手名/国家(从 results 行直接取)。
 * WCA /persons/:id/results 每行已含 name + country_iso2,无需再单独拉 profile(减半请求,降 burst)。
 */
async function fetchResultsFp(wcaId: string): Promise<{ map: FpMap; name: string | null; iso2: string | null }> {
  const arr = await wcaJson<RawResult[]>(`${WCA_API}/persons/${encodeURIComponent(wcaId)}/results`);
  const map: FpMap = {};
  let name: string | null = null;
  let iso2: string | null = null;
  for (const r of arr) {
    if (r?.id == null) continue;
    if (name === null && r.name) name = r.name;
    if (iso2 === null && r.country_iso2) iso2 = r.country_iso2;
    map[String(r.id)] = {
      c: r.competition_id ?? '',
      e: r.event_id ?? '',
      r: r.round_type_id ?? '',
      f: r.format_id ?? '',
      b: r.best ?? 0,
      a: r.average ?? 0,
      p: r.pos ?? 0,
      at: Array.isArray(r.attempts) ? r.attempts : [],
      rs: r.regional_single_record ?? null,
      ra: r.regional_average_record ?? null,
    };
  }
  return { map, name, iso2 };
}

// ── diff ─────────────────────────────────────────────────────────────────────

function attemptsEq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** 比对单条成绩的可变字段,返回变化清单(空数组 = 未变)。 */
function diffFp(before: Fp, after: Fp): ChangeField[] {
  const out: ChangeField[] = [];
  if (before.b !== after.b) out.push({ field: 'best', old: before.b, new: after.b });
  if (before.a !== after.a) out.push({ field: 'average', old: before.a, new: after.a });
  if (before.p !== after.p) out.push({ field: 'pos', old: before.p, new: after.p });
  if (!attemptsEq(before.at, after.at)) out.push({ field: 'attempts', old: before.at, new: after.at });
  if (before.rs !== after.rs) out.push({ field: 'regional_single_record', old: before.rs, new: after.rs });
  if (before.ra !== after.ra) out.push({ field: 'regional_average_record', old: before.ra, new: after.ra });
  return out;
}

/** 旧快照 → 新快照的 removed/modified 清单(忽略 added)。 */
function detectChanges(oldMap: FpMap, newMap: FpMap): DetectedChange[] {
  const out: DetectedChange[] = [];
  for (const [id, before] of Object.entries(oldMap)) {
    const after = newMap[id];
    if (!after) {
      out.push({
        resultId: Number(id),
        competitionId: before.c,
        eventId: before.e,
        roundTypeId: before.r,
        changeType: 'removed',
        fields: null,
        before,
        after: null,
      });
      continue;
    }
    const fields = diffFp(before, after);
    if (fields.length > 0) {
      out.push({
        resultId: Number(id),
        competitionId: after.c,
        eventId: after.e,
        roundTypeId: after.r,
        changeType: 'modified',
        fields,
        before,
        after,
      });
    }
  }
  return out;
}

/** 稳定 hash:按 result id 排序后序列化整张 fingerprint 映射。 */
function snapshotHash(map: FpMap): string {
  const keys = Object.keys(map).sort();
  const h = createHash('sha1');
  for (const k of keys) {
    const f = map[k]!;
    h.update(`${k}|${f.c}|${f.e}|${f.r}|${f.f}|${f.b}|${f.a}|${f.p}|${f.at.join(',')}|${f.rs ?? ''}|${f.ra ?? ''}\n`);
  }
  return h.digest('hex');
}

// ── PG ───────────────────────────────────────────────────────────────────────

interface SnapRow { results_json: FpMap; content_hash: string }

async function loadSnapshot(wcaId: string): Promise<SnapRow | null> {
  const rows = await query<SnapRow>(
    `SELECT results_json, content_hash FROM wca_person_results_snapshot WHERE wca_id = ?`,
    [wcaId],
  );
  return rows[0] ?? null;
}

async function saveSnapshot(
  wcaId: string,
  name: string | null,
  iso2: string | null,
  map: FpMap,
  hash: string,
  contentChanged: boolean,
): Promise<void> {
  await query(
    `INSERT INTO wca_person_results_snapshot
       (wca_id, person_name, country_iso2, results_json, result_count, content_hash, checked_at, updated_at)
     VALUES (?, ?, ?, ?::jsonb, ?, ?, NOW(), NOW())
     ON CONFLICT (wca_id) DO UPDATE SET
       person_name  = COALESCE(EXCLUDED.person_name, wca_person_results_snapshot.person_name),
       country_iso2 = COALESCE(EXCLUDED.country_iso2, wca_person_results_snapshot.country_iso2),
       results_json = EXCLUDED.results_json,
       result_count = EXCLUDED.result_count,
       content_hash = EXCLUDED.content_hash,
       checked_at   = NOW(),
       updated_at   = ${contentChanged ? 'NOW()' : 'wca_person_results_snapshot.updated_at'}`,
    [wcaId, name, iso2 ? iso2.toUpperCase() : null, map, Object.keys(map).length, hash],
  );
}

/** 只刷新 checked_at(整体未变时)。 */
async function touchChecked(wcaId: string, name: string | null, iso2: string | null): Promise<void> {
  await query(
    `UPDATE wca_person_results_snapshot
       SET checked_at = NOW(),
           person_name = COALESCE(?, person_name),
           country_iso2 = COALESCE(?, country_iso2)
     WHERE wca_id = ?`,
    [name, iso2 ? iso2.toUpperCase() : null, wcaId],
  );
}

async function insertChanges(wcaId: string, changes: DetectedChange[]): Promise<void> {
  for (const ch of changes) {
    await query(
      `INSERT INTO wca_result_changes
         (wca_id, result_id, competition_id, event_id, round_type_id, change_type, fields, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)`,
      [
        wcaId,
        ch.resultId,
        ch.competitionId || null,
        ch.eventId || null,
        ch.roundTypeId || null,
        ch.changeType,
        ch.fields ? ch.fields : null,
        ch.before ? ch.before : null,
        ch.after ? ch.after : null,
      ],
    );
  }
}

// ── Bark 汇总 ─────────────────────────────────────────────────────────────────

async function pushSummary(
  wcaId: string,
  displayName: string,
  iso2: string | null,
  changes: DetectedChange[],
): Promise<void> {
  const removed = changes.filter((c) => c.changeType === 'removed').length;
  const modified = changes.length - removed;
  const parts: string[] = [];
  if (removed) parts.push(`${removed} 条移除`);
  if (modified) parts.push(`${modified} 条修改`);
  const title = `往期成绩变更:${displayName}`;
  // 列前几条受影响项目/比赛,驱动点进页面看详情。
  const lines = changes.slice(0, 6).map((c) => {
    const verb = c.changeType === 'removed' ? '移除' : '修改';
    return `${verb} ${c.eventId} @ ${c.competitionId}`;
  });
  if (changes.length > 6) lines.push(`… 共 ${changes.length} 条`);
  const body = `${parts.join(',')}\n${lines.join('\n')}`;
  const zh = isChineseRegion(iso2);
  const url = `${SITE_BASE}${zh ? '/zh' : ''}/wca/result-watch?wcaId=${encodeURIComponent(wcaId)}`;
  await sendBark({ title, body, url, group: 'WCA Result Changes', sound: 'shake' });
}

// ── 单人处理 ──────────────────────────────────────────────────────────────────

async function processPerson(wcaId: string, fallbackName: string | null): Promise<number> {
  const { map: newMap, name: fetchedName, iso2 } = await fetchResultsFp(wcaId);
  const name = fetchedName ?? fallbackName;
  const newHash = snapshotHash(newMap);

  const prev = await loadSnapshot(wcaId);

  // 首跑:静默吸收,不记变更、不推。
  if (!prev) {
    await saveSnapshot(wcaId, name, iso2, newMap, newHash, true);
    return 0;
  }

  // 整体未变:只刷新 checked_at。
  if (prev.content_hash === newHash) {
    await touchChecked(wcaId, name, iso2);
    return 0;
  }

  const changes = detectChanges(prev.results_json ?? {}, newMap);

  // 仅 added(无 removed/modified):更新快照吸收,不记不推。
  if (changes.length === 0) {
    await saveSnapshot(wcaId, name, iso2, newMap, newHash, true);
    return 0;
  }

  await insertChanges(wcaId, changes);
  await saveSnapshot(wcaId, name, iso2, newMap, newHash, true);

  const displayName = (name ?? wcaId).trim() || wcaId;
  console.log(`[wca-past-results] ${wcaId} ${displayName}: ${changes.length} change(s)`);
  try {
    await pushSummary(wcaId, displayName, iso2, changes);
  } catch (e) {
    console.warn(`[wca-past-results] push failed ${wcaId}: ${(e as Error).message}`);
  }
  return changes.length;
}

// ── 有界并发轮询 ──────────────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
  const persons = await getWatchedPersons();
  if (persons.length === 0) return;

  const queue = [...persons];
  let totalChanges = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  let aborted = false;

  async function worker(): Promise<void> {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      try {
        totalChanges += await processPerson(p.wcaId, p.matchKey);
        consecutiveFailures = 0;
      } catch (e) {
        failures++;
        consecutiveFailures++;
        console.warn(`[wca-past-results] ${p.wcaId} failed: ${(e as Error).message}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          aborted = true;
          console.warn(`[wca-past-results] ${consecutiveFailures} consecutive failures — WCA likely rate-limiting this IP; aborting cycle, retry next interval`);
          return;
        }
      }
      if (queue.length > 0) await sleep(REQUEST_GAP_MS); // 礼貌间隔,避开 WCA burst 保护
    }
  }

  // CONCURRENCY=1 → 单 worker 串行;熔断标志由它设置
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));
  console.log(
    `[wca-past-results] cycle ${aborted ? 'ABORTED' : 'done'}: ${persons.length} watched, ${totalChanges} change(s), ${failures} fetch failure(s)`,
  );
}

/**
 * 独立门控(不跟实时监控套件 MONITORS_ENABLED 绑定):RESULT_WATCH_ENABLED=1 才轮询。
 * 这样可单独开启「往期成绩变更」记录,不会连带激活 5 个实时推送监控。
 * Bark 真推仍受 MONITOR_PUSH_ENABLED 控;关时只 DRY 日志,但变更照常入库 → 页面有数据。
 */
export function startWcaPastResultsMonitor(): void {
  if (process.env.RESULT_WATCH_ENABLED !== '1') {
    console.log('[wca-past-results] disabled (set RESULT_WATCH_ENABLED=1 to start)');
    return;
  }
  console.log(`[wca-past-results] starting, interval ${Math.round(INTERVAL_MS / 60000)}min`);
  startPoller('wca-past-results', runOnce, INTERVAL_MS);
}
