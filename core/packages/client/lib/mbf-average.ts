// 333mbf / 333mbo 非官方 Mo3 平均(WCA 不追踪此指标)。
// MBLD 有两套编码,按数值大小分流(旧 ≥ 1e9、新 < 1e9),不是按 event id —— 333mbf 永远新编码,
// 333mbo 历史里两套都有,甚至同一轮 attempts 混用。先把每把解到统一的三段(DD/TTTTT/MM),
// 各取 3 次均值(四舍五入)再拼回(均值 DD ≤ 99 用新编码,否则用旧编码),可直接喂 formatWcaResult。
// 算法与 packages/stats-build/src/core/mbf_average.ts 保持一致。

const OLD_FORMAT_MIN = 1_000_000_000; // 旧编码 1SSAATTTTT ≥ 1e9
const UNKNOWN_TIME = 99_999;          // TTTTT==99999 表示无时间记录(旧多盲多数无)

// 把一把 MBLD 成绩(旧 1SSAATTTTT / 新 0DDTTTTTMM)按数值大小解到新编码三段:
//   dd      = 99 - 差值(difference = solved - missed;旧编码负差值时 dd 可 > 99)
//   seconds = TTTTT(99999 = 未知)
//   missed  = MM
function decodeMbldFields(v: number): { dd: number; seconds: number; missed: number } {
  if (v >= OLD_FORMAT_MIN) {
    // 旧:1SSAATTTTT → solved = 99 - SS, attempted = AA, time = TTTTT 秒
    const seconds = v % 100_000;
    const head = Math.floor(v / 100_000);     // 1SSAA
    const attempted = head % 100;             // AA
    const ss = Math.floor(head / 100) % 100;  // SS
    const solved = 99 - ss;
    const missed = attempted - solved;
    const difference = solved - missed;       // = 2*solved - attempted
    return { dd: 99 - difference, seconds, missed };
  }
  // 新:0DDTTTTTMM → difference = 99 - DD, missed = MM, solved = difference + missed
  const missed = v % 100;
  const head = Math.floor(v / 100);           // DDTTTTT
  const seconds = head % 100_000;
  const dd = Math.floor(head / 100_000) % 100;
  return { dd, seconds, missed };
}

function mbfMo3Raw(v1: number, v2: number, v3: number): number {
  const f = [v1, v2, v3].map(decodeMbldFields);
  const dd = Math.round(f.reduce((s, x) => s + x.dd, 0) / 3);
  // 任一把无时间记录 → 均值时间记为未知(不能把 99999 哨兵当真值平均)
  const anyUnknownTime = f.some((x) => x.seconds === UNKNOWN_TIME);
  const ttttt = anyUnknownTime ? UNKNOWN_TIME : Math.round(f.reduce((s, x) => s + x.seconds, 0) / 3);
  const mm = Math.round(f.reduce((s, x) => s + x.missed, 0) / 3);
  if (dd <= 99) return dd * 10_000_000 + ttttt * 100 + mm; // 新编码(< 1e9)
  // 均值差值为负(dd > 99,新编码 2 位 DD 装不下)→ 退回旧编码 1SSAATTTTT
  const solved = (99 - dd) + mm;
  const attempted = solved + mm;
  return OLD_FORMAT_MIN + (99 - solved) * 10_000_000 + attempted * 100_000 + ttttt;
}

export const MBLD_AVG_EVENTS = new Set(['333mbf', '333mbo']);
export function isMbldEvent(eventId: string): boolean { return MBLD_AVG_EVENTS.has(eventId); }

// 从一轮 attempts 算 Mo3:恰好 3 次有效尝试且全部成功(>0)→ Mo3;
// 3 次里有 DNF/DNS(<0)→ 平均 DNF(-1);不足 3 次(0=空/未打)→ 0(无平均,展示层留空)。
export function computeMbfMo3(attempts: number[]): number {
  const vals = attempts.filter(v => v !== 0);
  if (vals.length !== 3) return 0;
  if (vals.some(v => v < 0)) return -1;
  return mbfMo3Raw(vals[0], vals[1], vals[2]);
}

// 选手页「有效平均」:有官方平均直接用;MBLD 无官方平均 → 用本轮 attempts 现算的非官方 Mo3。
// ByEventView / ByCompList 共用(排序、PR 名次、平均列展示都走它)。
export function effectiveMbldAverage(r: { average: number; attempts: number[] }, eventId: string): number {
  if (r.average && r.average !== 0) return r.average;
  if (isMbldEvent(eventId)) return computeMbfMo3(r.attempts);
  return r.average;
}
