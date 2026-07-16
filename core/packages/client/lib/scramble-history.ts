/**
 * 打乱历史 —— 有界环形队列(←/→ 回看上一条 / 前进下一条)。
 *
 * /timer(SoloView)与 /alg 训练器(trainer-store)共用同一份实现:
 * 队尾之外 forward 返回 null,由调用方生成新打乱再 push;超出上限丢最旧一条。
 */

export interface ScrambleHist<T> {
  list: T[];
  idx: number;
}

export const SCRAMBLE_HISTORY_CAP = 50;

/** 在队尾追加一条新记录(超上限丢最旧),游标落到新记录上。 */
export function histPush<T>(cur: ScrambleHist<T>, entry: T, cap = SCRAMBLE_HISTORY_CAP): ScrambleHist<T> {
  let list = [...cur.list, entry];
  if (list.length > cap) list = list.slice(1);
  return { list, idx: list.length - 1 };
}

/** 向后翻一条;已在最旧一条时返回 null。 */
export function histBack<T>(cur: ScrambleHist<T>): ScrambleHist<T> | null {
  if (cur.idx <= 0) return null;
  return { list: cur.list, idx: cur.idx - 1 };
}

/** 向前翻一条(仅历史中段);已在队尾时返回 null —— 调用方该生成新打乱了。 */
export function histForward<T>(cur: ScrambleHist<T>): ScrambleHist<T> | null {
  if (cur.idx >= cur.list.length - 1) return null;
  return { list: cur.list, idx: cur.idx + 1 };
}
