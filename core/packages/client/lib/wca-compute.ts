// 从各次成绩(WCA 厘秒 / 步数编码)重算 单次 + 平均。供「行内改某一次 → 自动重算」用。
// 编码:正数 = 时间厘秒 / FMC 步数;-1 = DNF;-2 = DNS;0 = 无成绩(余位)。
// 按 WCA event_id 区分平均口径(非 recon-utils 的事件命名)。
// 注:>10min 的秒级取整不处理;MBLD / 老多盲编码特殊,canRecompute 拦掉。

const MO3_EVENTS = new Set(['666', '777', '333fm']);        // 3 次取均值
const NO_AVG_EVENTS = new Set(['333bf', '444bf', '555bf', '333mbf', '333mbo', '333ft']); // best-of-N / 特殊:无平均

/** 该项目能否用简单规则重算(MBLD / 老多盲编码特殊,不重算)。 */
export function canRecompute(eventId: string): boolean {
  return !['333mbf', '333mbo', '333ft'].includes(eventId);
}

/** 单次 = 最小有效成绩;全 DNF/DNS → -1。 */
export function computeWcaBest(attempts: number[]): number {
  const valid = attempts.filter((v) => v > 0);
  return valid.length ? Math.min(...valid) : -1;
}

/**
 * 从各次成绩重算 { best, average }(均为 WCA 编码)。
 * Mo3(666/777/FMC):任一 DNF → 平均 DNF;否则 3 次均值(FMC ×100)。
 * Ao5(其余):≥2 个 DNF → DNF;否则去掉最好最差取中间 3 均值。
 * BLD / MBLD:无平均(average=null)。
 */
export function computeWcaBestAverage(attempts: number[], eventId: string): { best: number; average: number | null } {
  const best = computeWcaBest(attempts);
  if (NO_AVG_EVENTS.has(eventId)) return { best, average: null };

  const isMo3 = MO3_EVENTS.has(eventId);
  const n = isMo3 ? 3 : 5;
  const slice = attempts.slice(0, n);
  if (slice.length < n) return { best, average: null };
  const bad = slice.filter((v) => v <= 0).length; // DNF/DNS/无 都当最差

  if (isMo3) {
    if (bad > 0) return { best, average: -1 };
    const mean = (slice[0] + slice[1] + slice[2]) / 3;
    return { best, average: eventId === '333fm' ? Math.round(mean * 100) : Math.round(mean) };
  }
  // Ao5
  if (bad >= 2) return { best, average: -1 };
  const norm = slice.map((v) => (v <= 0 ? Infinity : v));
  const sorted = [...norm].sort((a, b) => a - b);
  return { best, average: Math.round((sorted[1] + sorted[2] + sorted[3]) / 3) };
}
