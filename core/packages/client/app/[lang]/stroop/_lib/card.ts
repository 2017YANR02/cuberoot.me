/**
 * Stroop 卡片生成 —— 纯函数,页面只管呈现与计时。
 *
 * 只做颜色维度的 Stroop(不掺数字 / 方向 / 大小那些变体),三种卡:
 *   patch       色块,没有字 —— 命名颜色的基线速度
 *   congruent   字和墨色一致(「红」写成红色)—— 弱一致促进
 *   incongruent 字和墨色冲突(「红」写成蓝色)—— 经典干扰卡
 * 干扰量 = 干扰卡每格用时 − 色块卡每格用时,所以三种卡必须同分布同长度,
 * 否则两次成绩不可比。
 *
 * 两条硬约束(经典纸卡也是这么排的,否则读起来会「顺下去」):
 *   1. 相邻两格墨色不同 —— 连着两个红会让人一眼扫过去,测不到东西;
 *   2. 每种颜色出现次数尽量均匀(相差 ≤1),不然抽到的卡有难有易。
 * 均匀 + 不相邻用贪心实现:每一步在「不等于上一格」的颜色里挑剩余份额最多的
 * (并列随机),这是最优排布,只要没有哪种颜色超过 ⌈n/2⌉ 就一定排得下 ——
 * 六色均分后恒成立。
 */

/**
 * 墨色就是魔方那六个面色 —— 站内配色单一源在 lib/cube-colors(U 白 D 黄 R 红
 * L 橙 B 蓝 F 绿),这里只借面名,色值由页面从那份表取,不在本文件复制一遍。
 */
export type StroopColor = 'white' | 'yellow' | 'red' | 'orange' | 'blue' | 'green';

/** 六色全集,顺序即 UI 图例顺序。 */
export const STROOP_COLORS: readonly StroopColor[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green'];

export const COLOR_NAMES: Record<StroopColor, { zh: string; en: string }> = {
  white:  { zh: '白', en: 'white' },
  yellow: { zh: '黄', en: 'yellow' },
  red:    { zh: '红', en: 'red' },
  orange: { zh: '橙', en: 'orange' },
  blue:   { zh: '蓝', en: 'blue' },
  green:  { zh: '绿', en: 'green' },
};

export type CardKind = 'patch' | 'congruent' | 'incongruent';
export const CARD_KINDS: readonly CardKind[] = ['patch', 'congruent', 'incongruent'];

export const CELL_COUNTS = [10, 20, 30, 40] as const;
export type CellCount = (typeof CELL_COUNTS)[number];

export interface StroopCell {
  /** 要报出来的墨色。 */
  ink: StroopColor;
  /** 印在格子里的颜色词;色块卡没有字 → null。 */
  word: StroopColor | null;
}

export type Rand = () => number;

/** 把 count 个格子均分给 colors:前 count % k 种各多拿 1 个。 */
function quotas(colors: readonly StroopColor[], count: number): Map<StroopColor, number> {
  const base = Math.floor(count / colors.length);
  const extra = count % colors.length;
  const q = new Map<StroopColor, number>();
  colors.forEach((c, i) => q.set(c, base + (i < extra ? 1 : 0)));
  return q;
}

/**
 * 在候选里挑剩余份额最多的一个(并列随机),并扣掉一份。
 * 候选为空时返回 null,由调用方决定怎么放宽约束。
 */
function takeMostRemaining(
  candidates: readonly StroopColor[],
  remaining: Map<StroopColor, number>,
  rand: Rand,
): StroopColor | null {
  let best = -1;
  let pool: StroopColor[] = [];
  for (const c of candidates) {
    const left = remaining.get(c) ?? 0;
    if (left <= 0) continue;
    if (left > best) { best = left; pool = [c]; }
    else if (left === best) pool.push(c);
  }
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(rand() * pool.length) % pool.length];
  remaining.set(pick, (remaining.get(pick) ?? 0) - 1);
  return pick;
}

/** 墨色序列:份额均匀 + 相邻不同。 */
function inkSequence(colors: readonly StroopColor[], count: number, rand: Rand): StroopColor[] {
  const remaining = quotas(colors, count);
  const out: StroopColor[] = [];
  for (let i = 0; i < count; i++) {
    const prev = out[i - 1];
    const pick = takeMostRemaining(colors.filter(c => c !== prev), remaining, rand)
      // 理论上到不了(均分后没有颜色超过 ⌈n/2⌉),留着免得约束以后放宽时静默排出重复。
      ?? takeMostRemaining(colors, remaining, rand)
      ?? colors[Math.floor(rand() * colors.length) % colors.length];
    out.push(pick);
  }
  return out;
}

/**
 * 干扰卡的字:必须 ≠ 本格墨色(这才是干扰),尽量 ≠ 上一格的字、尽量均匀。
 * 后两条是软的 —— 逐级放宽,唯一不放宽的是「≠ 墨色」。
 */
function wordSequence(inks: readonly StroopColor[], colors: readonly StroopColor[], rand: Rand): StroopColor[] {
  const remaining = quotas(colors, inks.length);
  const out: StroopColor[] = [];
  for (let i = 0; i < inks.length; i++) {
    const prev = out[i - 1];
    const usable = colors.filter(c => c !== inks[i]);
    const pick = takeMostRemaining(usable.filter(c => c !== prev), remaining, rand)
      ?? takeMostRemaining(usable, remaining, rand)
      ?? usable[Math.floor(rand() * usable.length) % usable.length];
    out.push(pick);
  }
  return out;
}

/**
 * 生成一张卡。count ≤ 0 返回空卡(调用方本来就该拦住,这里不抛)。
 * rand 可注入,测试拿种子化 RNG 锁死排布。
 */
export function generateCard(
  kind: CardKind,
  count: number,
  rand: Rand = Math.random,
): StroopCell[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const colors = STROOP_COLORS;
  const inks = inkSequence(colors, n, rand);
  if (kind === 'patch') return inks.map(ink => ({ ink, word: null }));
  if (kind === 'congruent') return inks.map(ink => ({ ink, word: ink }));
  const words = wordSequence(inks, colors, rand);
  return inks.map((ink, i) => ({ ink, word: words[i] }));
}

/** 一行几格 —— 词数固定 5 列(手机窄屏由 CSS 降到 4 / 3 列)。 */
export const CARD_COLUMNS = 5;
