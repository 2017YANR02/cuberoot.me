// WCA round_type_id → 显示元数据。
// 由 PersonDetailPage 的 ByEventView / ByCompList 和 ReconDetailPage 的 SameCompEventTable 共用。

export const ROUND_ORDER: Record<string, number> = {
  'f': 0, 'c': 1, 'b': 2,
  '3': 3,
  '2': 4, 'g': 4,
  '1': 5, 'd': 5,
  'h': 6,
};

export const ROUND_HINT_ZH = `轮次缩写:
R1 / R2 / R3 — 初赛 / 复赛 / 半决赛 (打满 5 把)
Fi — 决赛
C- 前缀 (组合赛制) — 带 cutoff,前几把过线才能继续打完整 Ao5
h — head-to-head 1v1 淘汰 (非 WCA 项目)`;

export const ROUND_HINT_ZH_HANT = `輪次縮寫:
R1 / R2 / R3 — 初賽 / 複賽 / 半決賽 (打滿 5 把)
Fi — 決賽
C- 字首 (組合賽制) — 帶 cutoff,前幾把過線才能繼續打完整 Ao5
h — head-to-head 1v1 淘汰 (非 WCA 項目)`;

export const ROUND_HINT_EN = `Round abbreviations:
R1 / R2 / R3 — First / Second / Third Round (full attempts)
Fi — Final
C- prefix (Combined) — cutoff format; must beat cutoff in first attempts to continue full Ao5
h — Head-to-head (1v1 elimination, non-WCA)`;

export function roundLabel(rt: string): string {
  const map: Record<string, string> = {
    'f': 'Fi', 'c': 'C-Fi', 'b': 'B-Fi',
    '3': 'R3',
    '2': 'R2', 'g': 'C-R2',
    '1': 'R1', 'd': 'C-R1',
    'h': 'R1',
  };
  return map[rt] ?? rt;
}

export function roundClass(rt: string): string {
  if (rt === 'f' || rt === 'c' || rt === 'b') return 'wp-round-final';
  if (rt === '3') return 'wp-round-semi';
  if (rt === '2' || rt === 'g') return 'wp-round-quarter';
  return 'wp-round-first';
}
