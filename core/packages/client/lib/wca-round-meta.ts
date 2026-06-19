// WCA round_type_id → 显示元数据。
// 由 PersonDetailPage 的 ByEventView / ByCompList 和 ReconDetailPage 的 SameCompEventTable 共用。

export const ROUND_ORDER: Record<string, number> = {
  'f': 0, 'c': 1, 'b': 2,
  '3': 3,
  '2': 4, 'g': 4, 'e': 4,
  '1': 5, 'd': 5,
  'h': 6, '0': 7,
};

export const ROUND_HINT_ZH = `R1 / R2 / R3 — 初赛 / 复赛 / 半决赛
Fi — 决赛`;

export const ROUND_HINT_EN = `R1 / R2 / R3 — First / Second / Third Round
Fi — Final`;

// 所有 WCA round_type_id 折叠到 4 档(组合赛制 C- / B-Final 一并并入对应基础轮次)。
type RoundBucket = 'first' | 'second' | 'third' | 'final';
function roundBucket(rt: string): RoundBucket {
  switch (rt) {
    case 'f': case 'c': case 'b': return 'final';     // 决赛 / 组合决赛 / B-决赛
    case '3': return 'third';                          // 半决赛
    case '2': case 'g': case 'e': return 'second';     // 复赛 / 组合复赛
    // '1' 'd' '0' 'h' 初赛 / 组合初赛 / 资格赛,及未知值
    default: return 'first';
  }
}

export function roundLabel(rt: string): string {
  return { first: 'R1', second: 'R2', third: 'R3', final: 'Fi' }[roundBucket(rt)];
}

export function roundClass(rt: string): string {
  return {
    first: 'wp-round-first', second: 'wp-round-quarter',
    third: 'wp-round-semi', final: 'wp-round-final',
  }[roundBucket(rt)];
}
