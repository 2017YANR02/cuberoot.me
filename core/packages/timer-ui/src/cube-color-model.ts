import type { TimerColorLetter as ColorLetter } from '@cuberoot/shared/timer';

export const CUBE_COLOR_LETTERS = 'WYGBOR';

/** 这段文字是不是纯色字母(1~2 片)。调用方拿它决定要不要摆色块。 */
export function isCubeColorLetters(s: string): boolean {
  return s.length >= 1 && s.length <= 2 && [...s].every(c => CUBE_COLOR_LETTERS.includes(c));
}

/**
 * 一条标注开头那一两个色字母,没有就是 null。
 *
 * `GR` / `OB` 是那一对 F2L 的两片侧贴纸,`W cross` 是十字的颜色 —— 都是 cubedb 那套
 * 写法,认得的人一秒,不认得的要背一张表。
 *
 * 只认**开头**、只认 1~2 个字母、后面必须断开(空白 / `/` / `+` / 括号 / 到头)。末层的
 * `OLL-F-` / `PLL-T` / `EPLL-Z` 因此一个都不会误中 —— 首字母要么不是色字母,要么
 * 后面紧跟着别的字母。宁可少摆一个色块,也不能给 `OLL-F-` 摆一个橙色块。
 */
export function leadingCubeColors(label: string): string | null {
  const m = /^([WYGBOR]{1,2})(?=$|[\s/(+])/.exec(label);
  return m ? m[1] : null;
}

export interface CubeColorGroup {
  colors: string;
  start: number;
  end: number;
}

/**
 * 找出复盘标注里的配色组。开头允许单色十字,其余位置只认双色 F2L 槽位,避免把
 * 注释中的单个转动字母当作颜色。
 */
export function cubeColorGroups(label: string): CubeColorGroup[] {
  const groups: CubeColorGroup[] = [];
  const candidates = label.matchAll(/[WYGBOR]{1,2}/g);
  for (const match of candidates) {
    const colors = match[0];
    const start = match.index;
    const end = start + colors.length;
    const beforeOk = start === 0 || /[\s(+/]/.test(label[start - 1]);
    const afterOk = end === label.length || /[\s/+).]/.test(label[end]);
    if (beforeOk && afterOk && (start === 0 || colors.length === 2)) {
      groups.push({ colors, start, end });
    }
  }
  return groups;
}

/**
 * 各色十字转到底面以后,F→R→B→L 四个侧面的标准配色。
 *
 * 朝向和 timer/reconstruct/orient.ts 的 ROTATION_TO_D 完全相同:白 U 用 z2、
 * 绿 F 用 x'、蓝 B 用 x、红 R 用 z、橙 L 用 z',黄 D 不动。F2L 的双色块按
 * 这条侧面环里靠前的颜色在左显示,所以白底的 RB 会稳定显示成 BR；另外五种底色
 * 也走同一条几何规则,不是各自碰运气沿用识别器给出的字母顺序。
 */
const F2L_SIDE_RING_BY_CROSS: Readonly<Record<ColorLetter, string>> = Object.freeze({
  W: 'GOBR',
  Y: 'GRBO',
  G: 'WRYO',
  B: 'YRWO',
  R: 'GWBY',
  O: 'GYBW',
});

/** 从一条复盘标签里读十字颜色；普通 F2L / OLL / PLL 标签返回 null。 */
export function crossColorFromLabel(label: string | null | undefined): ColorLetter | null {
  if (!label) return null;
  const match = /^([WYGBOR])\s+(?:ps|pseudo[_ -]?)?x*cross\b/i.exec(label.trim());
  return match ? match[1].toUpperCase() as ColorLetter : null;
}

/** 从一组标签里找这把的十字颜色。 */
export function crossColorFromLabels(labels: readonly (string | null | undefined)[]): ColorLetter | null {
  for (const label of labels) {
    const color = crossColorFromLabel(label);
    if (color) return color;
  }
  return null;
}

/** 从 /recon 的整段解法文字里找这把的十字颜色。 */
export function crossColorFromReconText(text: string): ColorLetter | null {
  const labels = text.split('\n').map((line) => {
    const commentStart = line.indexOf('//');
    return commentStart >= 0 ? line.slice(commentStart + 2).trimStart() : null;
  });
  return crossColorFromLabels(labels);
}

/** 按当前十字底色统一 F2L 两片贴纸的左右顺序；信息不足时保持原顺序。 */
export function f2lDisplayColors(colors: string, crossColor: ColorLetter | null): string {
  if (colors.length !== 2 || !crossColor) return colors;
  const ring = F2L_SIDE_RING_BY_CROSS[crossColor];
  const [a, b] = colors;
  const ai = ring.indexOf(a);
  const bi = ring.indexOf(b);
  if (ai < 0 || bi < 0) return colors;
  return ai <= bi ? colors : `${b}${a}`;
}

/** Color-only grouping punctuation is presentation-free in both recon views. */
export function cubeColorGroupPunctuation(line: string, groupsInLabel = cubeColorGroups(line)): Set<number> {
  const hiddenBrackets = new Set<number>();
  for (const match of line.matchAll(/\(([^()]*)\)/g)) {
    const start = match.index!;
    const end = start + match[0].length - 1;
    const groups = groupsInLabel.filter(group => group.start > start && group.end <= end);
    if (!groups.length) continue;
    let remainder = line.slice(start + 1, end);
    for (const group of [...groups].reverse()) {
      remainder = remainder.slice(0, group.start - start - 1) + remainder.slice(group.end - start - 1);
    }
    if (/^[\s+]*$/.test(remainder)) {
      hiddenBrackets.add(start); hiddenBrackets.add(end);
      for (let offset = start + 1; offset < end; offset++) {
        if (line[offset] === '+') hiddenBrackets.add(offset);
      }
    }
  }
  return hiddenBrackets;
}
