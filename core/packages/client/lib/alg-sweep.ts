/**
 * 「过遍」进度 —— 哪些范围整轮过完了、现在停在哪。纯函数,存取与云同步在 `alg-sweep-store.ts`。
 *
 * 为什么要这一层:标记(`trainer-marks`)与记忆(`alg-srs`)都是**一 case 一行**。
 * 库内集最大的 1LLL 才 3915 个,怎么存都行;LSLL 是 149,188 个(302 条 ZBLS × 494 个 ZBLL
 * 收尾),一行连数据带索引 ~355 B,练满就是 29.8 万行 / 52 MB 一个人 —— 服务端 20,000 条
 * 上限按 302 个/天算第 66 天就撞墙,而且撞了只在 console 里 warn,页面上一个字都没有。
 *
 * 但「这一轮 302 个我过完了」这件事,一整轮只要一个数。把它提上来单独记,那一轮里
 * **没有手动标记**的 per-case 记录就可以折叠掉 —— 存量从几十万行掉到几千行,上限失去意义。
 *
 * 四条口径全在这个文件里,别散到调用方:
 *  1. 「过完一轮」两种模式各有判据(都在 run 页):复习(recap)= 队列走到尾;
 *     记忆(memo)没有队列尾,= 本场里本轮每个 case 都拿到了排期。训练(train)是随机抽,
 *     永远抽不全,连成绩带排期一律不记(run 页 `mode === 'train'` 那处 skip)。
 *  2. 折叠只在记录数过水位({@link FOLD_WATERLINE})之后发生 —— PLL 21 个、ZBLL 494 个
 *     永远到不了,行为一个字节不变;只有 LSLL 这个量级才会触发。
 *  3. 手动标过(不熟 / 已掌握 / 星标)的 case 永远不折叠 —— 那是用户自己下的判断,
 *     不能替他扔。折叠掉的只有系统自己算出来的记忆排期。
 *  4. 折叠是**有损**的:那一轮每张卡的排期没了,回头重练算全新的卡。但「过完了」这件事
 *     位图里记着,不会丢。所以折叠只在整轮完成时发生,没完成的一条不碰。
 */

/** 记录数过这条线才开始折叠。库内集(最大 1LLL 3915)永远到不了 ⟹ 老行为原样。 */
export const FOLD_WATERLINE = 5000;

/**
 * 每个范围过完几遍。key = `?scope=` 的值(整集没有 scope 时用 `''`),值 = 遍数(≥1)。
 *
 * 为什么是「遍数」而不是一个 bit:多存一个字节,换来「这一轮我刷过 3 遍」这种真话,
 * 而且合并时取 max 就是对的语义,不用另立时间戳。
 */
export type SweepCounts = Record<string, number>;

/** 停在哪 —— 「继续第 67 轮 128/302」那行字的全部来源。 */
export interface SweepCursor {
  /** `?scope=` 的值;整集为 `''`。 */
  scope: string;
  /** 本轮已过到第几个(1 起;0 = 这一轮还没开始)。 */
  pos: number;
  /** 本轮一共几个(pos 的分母)。 */
  total: number;
}

export interface SetSweep {
  counts: SweepCounts;
  cursor: SweepCursor | null;
  /** 最后更新时刻,多设备 last-write-wins 用(只管 cursor;counts 取 max 不需要它)。 */
  t: number;
}

export const emptySweep = (): SetSweep => ({ counts: {}, cursor: null, t: 0 });

/** `?scope=` 归一:null / undefined / 空白 → `''`(整集)。 */
export const sweepKey = (scope: string | null | undefined): string => (scope ?? '').trim().toLowerCase();

/** 这个范围过完几遍(没过完 = 0)。 */
export const sweptTimes = (sw: SetSweep, scope: string | null | undefined): number =>
  sw.counts[sweepKey(scope)] ?? 0;

export const isSwept = (sw: SetSweep, scope: string | null | undefined): boolean =>
  sweptTimes(sw, scope) > 0;

/** 至少过完一遍的范围有几个(LSLL:「494 轮里走完了 66 轮」)。 */
export const sweptScopes = (sw: SetSweep): number =>
  Object.values(sw.counts).filter(n => n > 0).length;

/** 记一次「这个范围整轮过完了」。同一范围再过一遍就 +1。 */
export function markSwept(sw: SetSweep, scope: string | null | undefined, now: number): SetSweep {
  const k = sweepKey(scope);
  return { ...sw, counts: { ...sw.counts, [k]: (sw.counts[k] ?? 0) + 1 }, t: now };
}

/**
 * 挪游标。pos 只进不退 —— 同一范围内回看历史(←)不该把「练到哪了」拨回去;
 * 换了范围则无条件重置。返回原对象表示没有实质变化(调用方据此跳过落盘 / 上云)。
 */
export function setCursor(sw: SetSweep, next: SweepCursor, now: number): SetSweep {
  const cur = sw.cursor;
  if (cur && cur.scope === next.scope) {
    if (next.pos <= cur.pos && next.total === cur.total) return sw;
    return { ...sw, cursor: { ...next, pos: Math.max(cur.pos, next.pos) }, t: now };
  }
  return { ...sw, cursor: next, t: now };
}

/**
 * 本地 vs 云端合并。counts 逐范围取 max(离线各刷各的,取 max 不会重复计,与
 * `alg-srs` 的每日日志同一套语义);cursor 取 `t` 新的那边。
 *
 * 返回 `dirty` = 合并结果与云端不同 ⟹ 要回传。云端更新时不回传。
 */
export function mergeSweep(local: SetSweep, cloud: SetSweep): { merged: SetSweep; dirty: boolean } {
  const counts: SweepCounts = { ...cloud.counts };
  let dirty = false;
  for (const k in local.counts) {
    const l = local.counts[k];
    if (l > (counts[k] ?? 0)) { counts[k] = l; dirty = true; }
  }
  // 云端有而本地没有的范围不算 dirty(它本来就在云上)
  const localNewer = local.t > cloud.t;
  const cursor = localNewer ? local.cursor : cloud.cursor;
  if (localNewer && !sameCursor(local.cursor, cloud.cursor)) dirty = true;
  return { merged: { counts, cursor, t: Math.max(local.t, cloud.t) }, dirty };
}

const sameCursor = (a: SweepCursor | null, b: SweepCursor | null): boolean =>
  a === b || (!!a && !!b && a.scope === b.scope && a.pos === b.pos && a.total === b.total);

/**
 * 这一轮过完了,里面哪些 case 的记忆记录可以折叠(删)?
 *
 * 折叠条件三个全中:① 记录数已过水位 ② 该 case 没有任何手动标记 ③ 它确实有记录。
 * `marked` 传「有标记的 case key 集合」—— 状态和星标都算,清空标记留下的墓碑不算。
 *
 * 不够水位时返回空数组:小集(PLL / ZBLL / 1LLL)永远走这条,行为与今天完全一致。
 */
export function foldableKeys(
  roundKeys: readonly string[],
  hasRec: (key: string) => boolean,
  marked: ReadonlySet<string>,
  totalRecs: number,
): string[] {
  if (totalRecs <= FOLD_WATERLINE) return [];
  const out: string[] = [];
  for (const k of roundKeys) {
    if (marked.has(k)) continue;
    if (!hasRec(k)) continue;
    out.push(k);
  }
  return out;
}
