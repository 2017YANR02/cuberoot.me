/**
 * 公式记忆调度引擎 —— 间隔重复(SM-2 变体),按「背魔方公式」的特点调过参数。
 *
 * 与 Anki 的差别(都是刻意的):
 *  - 起步间隔更短:公式靠手感,第一次记住后 1 天内必须再碰一次,否则手上没留下东西。
 *  - 只有 4 档评分(忘了 / 犹豫 / 记得 / 秒答)—— 魔方选手自评的粒度就这么粗,再细是噪声。
 *  - 「忘了」不排到明天,而是当场重来(iv = 0 ⟹ due = now),由训练器把它塞回本场队列尾部;
 *    离场前没刷到也无所谓 —— 记录已经是「立刻到期」,下次进来第一个就是它。
 *  - 间隔到 21 天视为长期记住(MASTER_DAYS),训练器据此自动把标记升到「已掌握」。
 *
 * 本文件是纯函数(无 storage / 无 React),存取与云同步在 `alg-srs-store.ts`。
 */

/** 自评:0 忘了 · 1 犹豫 · 2 记得 · 3 秒答。 */
export type SrsGrade = 0 | 1 | 2 | 3;

/** 一张卡片的记忆状态。字段名压到 1-2 字符 —— 整套 ZBLL 是 472 条,要塞进 localStorage。 */
export interface SrsRec {
  /** 下次到期(epoch ms)。 */
  d: number;
  /** 当前间隔(天)。0 = 正在重学(本场再来)。 */
  iv: number;
  /** 难度因子(SM-2 的 EF):越低说明这条越难,间隔涨得越慢。 */
  ef: number;
  /** 累计复习次数。 */
  n: number;
  /** 遗忘次数(评过几次「忘了」)。 */
  l: number;
  /** 当前连续答对次数(评「忘了」清零)。 */
  st: number;
  /** 上次复习时间(epoch ms)。同时充当多设备 last-write-wins 的版本号。 */
  t: number;
  /** 最近 12 次评分,每次 2 bit,最新的在低位。 */
  h: number;
}

export type SrsRecs = Record<string, SrsRec>;

export const EF_DEFAULT = 2.4;
const EF_MIN = 1.3;
const EF_MAX = 2.9;
/** 间隔达到这个天数 = 长期记住,训练器据此升「已掌握」。 */
export const MASTER_DAYS = 21;
/** 间隔上限(一年);再长就没有复习的意义了。 */
const MAX_IV = 365;
const DAY_MS = 86_400_000;
/** 评分 → EF 增量(SM-2 原式在 4 档上的取值)。 */
const EF_DELTA: Record<SrsGrade, number> = { 0: -0.3, 1: -0.15, 2: 0, 3: 0.1 };
/** 「犹豫」的间隔倍率(比 EF 慢,但仍往前走)。 */
const HARD_MULT = 1.2;
/** 「秒答」在 EF 之上的额外加成。 */
const EASY_BONUS = 1.3;
/** 首次(或重学后)答对的间隔:记得 1 天、秒答 3 天。 */
const FIRST_IV: Record<2 | 3, number> = { 2: 1, 3: 3 };
/** 最近评分历史保留几次(h 是 2bit/次的位串)。 */
export const HIST_LEN = 12;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** 一张还没练过的新卡。 */
export function newSrsRec(): SrsRec {
  return { d: 0, iv: 0, ef: EF_DEFAULT, n: 0, l: 0, st: 0, t: 0, h: 0 };
}

/** 评分历史压进 h 的低位(最新在低位,保留最近 HIST_LEN 次)。 */
function pushHist(h: number, g: SrsGrade): number {
  return ((h << 2) | g) & ((1 << (HIST_LEN * 2)) - 1);
}

/** 读第 i 次(0 = 最近一次)的评分;超出已有次数返回 null。 */
export function histAt(rec: SrsRec, i: number): SrsGrade | null {
  if (i < 0 || i >= Math.min(rec.n, HIST_LEN)) return null;
  return ((rec.h >> (i * 2)) & 3) as SrsGrade;
}

/** 最近若干次评分(新→旧),最多 HIST_LEN 条。 */
export function recentGrades(rec: SrsRec): SrsGrade[] {
  const out: SrsGrade[] = [];
  for (let i = 0; i < Math.min(rec.n, HIST_LEN); i++) out.push(((rec.h >> (i * 2)) & 3) as SrsGrade);
  return out;
}

/**
 * 打一次分,算出新的记忆状态。纯函数 —— 同样的输入永远同样的输出。
 *
 * @param fuzz 间隔抖动,取值 [-1, 1],最终间隔 ×(1 ± 5%)。整套 472 条同一天全刷一遍时,
 *             不抖动会导致它们永远同一天一起到期(某天 472 张卡);抖动把它们摊开。
 *             ≤3 天的间隔不抖(抖了就跑到「今天」或差太远)。调用方传随机数,测试传 0。
 */
export function scheduleNext(rec: SrsRec | undefined, grade: SrsGrade, now: number, fuzz = 0): SrsRec {
  const r = rec ?? newSrsRec();
  const ef = clamp(r.ef + EF_DELTA[grade], EF_MIN, EF_MAX);
  // iv < 1 ⟹ 新卡或正在重学 —— 这两种情况用固定的起步间隔,不按 EF 放大。
  const fresh = r.iv < 1;

  let iv: number;
  if (grade === 0) {
    iv = 0;                                              // 忘了:当场重来
  } else if (grade === 1) {
    iv = fresh ? 0 : Math.max(1, r.iv * HARD_MULT);      // 犹豫:新卡/重学中也重来,已成形的慢慢涨
  } else {
    iv = fresh ? FIRST_IV[grade] : r.iv * ef * (grade === 3 ? EASY_BONUS : 1);
  }

  if (iv >= 4) iv *= 1 + fuzz * 0.05;
  iv = iv > 0 ? clamp(Math.round(iv), 1, MAX_IV) : 0;

  return {
    d: iv > 0 ? now + iv * DAY_MS : now,
    iv,
    ef,
    n: r.n + 1,
    l: r.l + (grade === 0 ? 1 : 0),
    st: grade === 0 ? 0 : r.st + 1,
    t: now,
    h: pushHist(r.h, grade),
  };
}

/** 四个评分按钮上要显示的「下次什么时候再见」预览(天;0 = 本场重来)。 */
export function previewIntervals(rec: SrsRec | undefined, now: number): Record<SrsGrade, number> {
  return {
    0: scheduleNext(rec, 0, now).iv,
    1: scheduleNext(rec, 1, now).iv,
    2: scheduleNext(rec, 2, now).iv,
    3: scheduleNext(rec, 3, now).iv,
  };
}

// ── 卡片分档 ────────────────────────────────────────────────────────

/** 卡片成熟度:new 没练过 · relearn 正在重学 · young 间隔 < 21 天 · mature ≥ 21 天。 */
export type SrsPhase = 'new' | 'relearn' | 'young' | 'mature';

export function srsPhase(rec: SrsRec | undefined): SrsPhase {
  if (!rec || rec.n === 0) return 'new';
  if (rec.iv < 1) return 'relearn';
  return rec.iv >= MASTER_DAYS ? 'mature' : 'young';
}

export const isDue = (rec: SrsRec | undefined, now: number): boolean => !rec || rec.n === 0 || rec.d <= now;

/** 一套 set 的记忆统计(分母 total 由调用方给 —— 引擎不知道这套一共几个 case)。 */
export interface SrsSetStat {
  /** 练过(有记录)的 case 数。 */
  tracked: number;
  /** 现在到期该复习的(不含从没练过的新卡)。 */
  due: number;
  relearn: number;
  young: number;
  mature: number;
  /** 累计遗忘次数。 */
  lapses: number;
  /** 累计复习次数。 */
  reviews: number;
  /** 最近一次复习时间(0 = 从没练过)。 */
  lastAt: number;
}

export const emptySrsStat = (): SrsSetStat => ({
  tracked: 0, due: 0, relearn: 0, young: 0, mature: 0, lapses: 0, reviews: 0, lastAt: 0,
});

/** 把一套 set 的记录归约成统计。`keys` 给了就只统计这些 case(过滤掉已下线的 case)。 */
export function summarizeSrs(recs: SrsRecs, now: number, keys?: Set<string>): SrsSetStat {
  const s = emptySrsStat();
  for (const k in recs) {
    if (keys && !keys.has(k)) continue;
    const r = recs[k];
    if (r.n === 0) continue;
    s.tracked++;
    s.lapses += r.l;
    s.reviews += r.n;
    if (r.t > s.lastAt) s.lastAt = r.t;
    if (r.iv < 1) s.relearn++;
    else if (r.iv >= MASTER_DAYS) s.mature++;
    else s.young++;
    if (r.d <= now) s.due++;
  }
  return s;
}

/** 未来 `days` 天每天的到期数(第 0 格 = 今天,含已经过期的)。 */
export function dueForecast(recs: SrsRecs, now: number, days: number): number[] {
  const out = new Array<number>(days).fill(0);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  for (const k in recs) {
    const r = recs[k];
    if (r.n === 0) continue;
    const idx = Math.floor((r.d - startOfToday) / DAY_MS);
    if (idx < 0) out[0]++;
    else if (idx < days) out[idx]++;
  }
  return out;
}

/**
 * 记忆保持率 = 最近若干次复习里「没忘」(评分 ≥ 犹豫)的比例。
 * 只看每张卡最近 HIST_LEN 次,新卡的第一次不算(第一次必然是「还没记住」,算进去会拉低到失真)。
 */
export function retention(recs: SrsRecs): { rate: number; samples: number } {
  let ok = 0, total = 0;
  for (const k in recs) {
    const r = recs[k];
    const seen = Math.min(r.n, HIST_LEN);
    // 卡片总复习次数 ≤ 1 时没有「保持」可言(还没经历过间隔)
    if (r.n <= 1) continue;
    // h 里最旧的那次若正是这张卡的第一次复习,跳过它
    const skipFirst = r.n <= HIST_LEN ? 1 : 0;
    for (let i = 0; i < seen - skipFirst; i++) {
      const g = (r.h >> (i * 2)) & 3;
      total++;
      if (g > 0) ok++;
    }
  }
  return { rate: total > 0 ? ok / total : 0, samples: total };
}

/**
 * 计时成绩 → 自评等级。快慢用**本场所有成功成绩的中位数**当基线 —— 绝对秒数
 * 对不同水平的人毫无意义,同一个人自己的中位数才是。
 *   DNF = 忘了;+2 最多算犹豫;显著慢于自己 = 犹豫;正常 = 记得;明显快 = 秒答。
 */
export function gradeFromSolve(ms: number, penalty: 'ok' | '+2' | 'DNF', medianMs: number | null): SrsGrade {
  if (penalty === 'DNF') return 0;
  if (penalty === '+2') return 1;
  if (medianMs == null || medianMs <= 0) return 2;   // 本场还没有基线
  const ratio = ms / medianMs;
  if (ratio <= 0.75) return 3;
  if (ratio <= 1.35) return 2;
  return 1;
}

/** 薄弱卡片排序键:遗忘次数优先,其次 EF 低,再次间隔短。越大越弱。 */
export function weakness(rec: SrsRec): number {
  return rec.l * 100 + (EF_MAX - rec.ef) * 10 + 1 / (rec.iv + 1);
}

// ── 每日活跃(热力图 / 连续天数)────────────────────────────────────

/** `YYYY-MM-DD` → [复习次数, 其中评「忘了」的次数]。按本地时区分日。 */
export type SrsDaily = Record<string, [number, number]>;

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 记一次复习(返回新对象,不改原来的)。 */
export function bumpDaily(daily: SrsDaily, ts: number, grade: SrsGrade): SrsDaily {
  const k = dayKey(ts);
  const [n, again] = daily[k] ?? [0, 0];
  return { ...daily, [k]: [n + 1, again + (grade === 0 ? 1 : 0)] };
}

/**
 * 连续复习天数。今天还没练不断链(算到昨天为止)—— 否则每天早上一睁眼就显示「连续 0 天」,
 * 那是在惩罚还没开始练的人。
 */
export function streakDays(daily: SrsDaily, now: number): number {
  let streak = 0;
  const start = daily[dayKey(now)] ? 0 : 1;
  for (let i = start; ; i++) {
    const k = dayKey(now - i * DAY_MS);
    if (!daily[k]) break;
    streak++;
  }
  return streak;
}

/** 多设备合并每日日志:同一天取两边较大值(离线各刷各的,最多少算,不会凭空多算)。 */
export function mergeDaily(a: SrsDaily, b: SrsDaily): SrsDaily {
  const out: SrsDaily = { ...a };
  for (const k in b) {
    const x = out[k], y = b[k];
    out[k] = x ? [Math.max(x[0], y[0]), Math.max(x[1], y[1])] : y;
  }
  return out;
}

/**
 * 热力图网格:最后一列 = 本周,每列 7 格(周日在上,与 GitHub 一致)。
 * 返回 `weeks` 列,每列 7 个 `{ day, n } | null`(null = 超出今天的未来格)。
 */
export interface HeatCell { day: string; n: number; ts: number }
export function heatmapGrid(daily: SrsDaily, now: number, weeks: number): Array<Array<HeatCell | null>> {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  // 本周日(含今天所在周)
  const weekEnd = today.getTime() + (6 - today.getDay()) * DAY_MS;
  const grid: Array<Array<HeatCell | null>> = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col: Array<HeatCell | null> = [];
    for (let d = 0; d < 7; d++) {
      const ts = weekEnd - w * 7 * DAY_MS - (6 - d) * DAY_MS;
      if (ts > today.getTime()) { col.push(null); continue; }
      const k = dayKey(ts);
      col.push({ day: k, n: daily[k]?.[0] ?? 0, ts });
    }
    grid.push(col);
  }
  return grid;
}

// ── 多设备合并(与 trainer-marks 的 mergeMarks 同构:逐条 last-write-wins)───

export interface SrsPutItem extends SrsRec { k: string }

export const toSrsPutItem = (k: string, r: SrsRec): SrsPutItem => ({ k, ...r });

/** 逐条按 `t`(上次复习时间)取新的一边;本地更新的差异集回传服务器。 */
export function mergeSrs(local: SrsRecs, cloud: SrsRecs): { merged: SrsRecs; toUpload: SrsPutItem[] } {
  const merged: SrsRecs = {};
  const toUpload: SrsPutItem[] = [];
  for (const k of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const l = local[k], c = cloud[k];
    if (l && c) {
      if (l.t > c.t) { merged[k] = l; toUpload.push(toSrsPutItem(k, l)); }
      else merged[k] = c;
    } else if (l) {
      merged[k] = l;
      if (l.n > 0) toUpload.push(toSrsPutItem(k, l));
    } else {
      merged[k] = c;
    }
  }
  return { merged, toUpload };
}

// ── 出题队列 ────────────────────────────────────────────────────────

/** 队列里一张卡的来源:due 到期复习 · new 没练过的新卡 · extra 超额加练。 */
export type SrsQueueKind = 'due' | 'new' | 'extra';
export interface SrsQueueItem { key: string; kind: SrsQueueKind }

export interface BuildQueueOpts {
  /** 本场最多出多少张新卡(0 = 只复习不学新的)。 */
  newLimit: number;
  /** 本场上限(到期卡 + 新卡);超出的截断。 */
  sessionLimit: number;
  /** 到期卡都刷完、新卡也用光时,是否继续按「最该练的」加练。 */
  fillExtra: boolean;
  /** 洗牌用的随机源(测试传固定值)。 */
  rand?: () => number;
}

/**
 * 组本场的记忆队列:到期卡(最该练的在前)→ 新卡 → 可选加练。
 *
 * 到期卡内部排序:过期越久越前,同期按薄弱度。新卡按 `pool` 给的顺序(= set 里的规范序,
 * 一组一组学下来比随机跳更容易建立联系)。到期与新卡**交错**排布 —— 一上来连吃 20 张新卡
 * 会把人劝退,穿插着复习手感更连贯。
 */
export function buildSrsQueue(
  pool: string[], recs: SrsRecs, now: number, opts: BuildQueueOpts,
): SrsQueueItem[] {
  const due: string[] = [];
  const fresh: string[] = [];
  const rest: string[] = [];
  for (const k of pool) {
    const r = recs[k];
    if (!r || r.n === 0) fresh.push(k);
    else if (r.d <= now) due.push(k);
    else rest.push(k);
  }
  due.sort((a, b) => (recs[a].d - recs[b].d) || (weakness(recs[b]) - weakness(recs[a])));

  const dueTake = due.slice(0, opts.sessionLimit);
  const newTake = fresh.slice(0, Math.max(0, Math.min(opts.newLimit, opts.sessionLimit - dueTake.length)));

  // 交错:把新卡均匀插进到期卡里
  const out: SrsQueueItem[] = [];
  const step = newTake.length > 0 ? Math.max(1, Math.floor(dueTake.length / newTake.length)) : 0;
  let ni = 0;
  for (let i = 0; i < dueTake.length; i++) {
    out.push({ key: dueTake[i], kind: 'due' });
    if (step > 0 && ni < newTake.length && (i + 1) % step === 0) out.push({ key: newTake[ni++], kind: 'new' });
  }
  while (ni < newTake.length) out.push({ key: newTake[ni++], kind: 'new' });

  if (opts.fillExtra && out.length < opts.sessionLimit) {
    // 加练:没到期的里挑最弱的补齐,让「今天没到期」也不至于无事可做
    const extra = rest.slice().sort((a, b) => weakness(recs[b]) - weakness(recs[a]));
    for (const k of extra) {
      if (out.length >= opts.sessionLimit) break;
      out.push({ key: k, kind: 'extra' });
    }
  }
  return out;
}
