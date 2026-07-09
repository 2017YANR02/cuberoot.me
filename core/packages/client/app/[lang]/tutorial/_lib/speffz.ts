/**
 * Speffz 字母方案纯计算(2x2 直到任意 NxN)。
 *
 * 规则来源:《Speffz Letter Scheme》docx(stats/tutorial/posts/speffz-letter-scheme.json 的原稿),
 * 已用脚本逐格核对原 docx 全部 19 张展开表,与本文件的计算完全一致。
 *
 * 统一规则(适用于所有阶数、所有块类型):
 * 1. 面顺序 U L F R B D,每面依次占 4 个连续字母:U=A-D L=E-H F=I-L R=M-P B=Q-T D=U-X。
 * 2. 展开图上正视每个面(B 面按 y2 转体后正视),把面分成 4 个象限:
 *    偶数阶为均分四块;奇数阶为绕固定中心的风车形(见 quadrantIndex)。
 *    字母 = 面基准字母 + 象限序号(左上 0 → 右上 1 → 右下 2 → 左下 3,即顺时针)。
 * 3. 每种块的每个轨道(orbit)独立套用同一份 24 字母,互不影响。
 * 4. 无字母的贴纸:奇数阶固定中心;half wing(每条边上顺时针后半段的翼棱贴纸——
 *    每个翼棱块有两张贴纸,恰好一张在前半段有字母、一张在后半段无字母)。
 */

export type SpeffzFace = 'U' | 'L' | 'F' | 'R' | 'B' | 'D';

export const SPEFFZ_FACES: SpeffzFace[] = ['U', 'L', 'F', 'R', 'B', 'D'];

/** 每面首字母在 A-X 里的偏移。 */
export const FACE_LETTER_BASE: Record<SpeffzFace, number> = {
  U: 0, L: 4, F: 8, R: 12, B: 16, D: 20,
};

export type StickerType =
  | 'corner'
  | 'edge' // 仅 3x3(中层棱)
  | 'midge' // 奇数阶 ≥5 的中棱
  | 'wing' // 有字母的翼棱贴纸(顺时针前半段)
  | 'half-wing' // 无字母的翼棱贴纸(顺时针后半段)
  | 'x-center'
  | 'plus-center'
  | 'oblique'
  | 'fixed-center';

export type DiagramType =
  | 'x-center'
  | 'plus-center'
  | 'oblique'
  | 'wing'
  | 'corner'
  | 'edge'
  | 'midge'
  | 'all';

/**
 * 贴纸 (r, c) 在 n 阶面内的象限序号:0=左上 1=右上 2=右下 3=左下;
 * 奇数阶固定中心返回 null。
 * 奇数阶为风车形四分(m=(n-1)/2):
 *   0: r<m 且 c<=m   1: c>m 且 r<=m   2: r>m 且 c>=m   3: c<m 且 r>=m
 */
export function quadrantIndex(n: number, r: number, c: number): 0 | 1 | 2 | 3 | null {
  if (n % 2 === 0) {
    const m = n / 2;
    if (r < m) return c < m ? 0 : 1;
    return c < m ? 3 : 2;
  }
  const m = (n - 1) / 2;
  if (r === m && c === m) return null;
  if (r < m && c <= m) return 0;
  if (c > m && r <= m) return 1;
  if (r > m && c >= m) return 2;
  return 3;
}

/** 边界非角贴纸距“顺时针方向前一个角”的步数(1..n-2);角或内部贴纸返回 null。 */
function edgeOffset(n: number, r: number, c: number): number | null {
  const onTop = r === 0;
  const onBottom = r === n - 1;
  const onLeft = c === 0;
  const onRight = c === n - 1;
  if ((onTop || onBottom) && (onLeft || onRight)) return null; // 角
  if (onTop) return c;
  if (onRight) return r;
  if (onBottom) return n - 1 - c;
  if (onLeft) return n - 1 - r;
  return null; // 内部
}

/** 贴纸 (r, c) 在 n 阶面内的块类型。 */
export function classifySticker(n: number, r: number, c: number): StickerType {
  const border = r === 0 || r === n - 1 || c === 0 || c === n - 1;
  if (border) {
    const d = edgeOffset(n, r, c);
    if (d === null) return 'corner';
    const mirror = n - 1 - d;
    if (d === mirror) return n === 3 ? 'edge' : 'midge';
    return d < mirror ? 'wing' : 'half-wing';
  }
  const m = (n - 1) / 2;
  if (n % 2 === 1 && r === m && c === m) return 'fixed-center';
  if (r === c || r === n - 1 - c) return 'x-center';
  if (n % 2 === 1 && (r === m || c === m)) return 'plus-center';
  return 'oblique';
}

/** 贴纸 (r, c) 的 Speffz 字母;固定中心与 half wing 返回 null。 */
export function stickerLetter(face: SpeffzFace, n: number, r: number, c: number): string | null {
  const t = classifySticker(n, r, c);
  if (t === 'fixed-center' || t === 'half-wing') return null;
  const q = quadrantIndex(n, r, c);
  if (q === null) return null;
  return String.fromCharCode(65 + FACE_LETTER_BASE[face] + q);
}

/** n 阶下应展示的分块图,顺序与原 docx 一致(X 心 → 十字心 → 斜心 → 翼棱 → 角 → 棱/中棱 → 全部)。 */
export function diagramTypesFor(n: number): DiagramType[] {
  const out: DiagramType[] = [];
  if (n >= 4) out.push('x-center');
  if (n % 2 === 1 && n >= 5) out.push('plus-center');
  if (n >= 6) out.push('oblique');
  if (n >= 4) out.push('wing');
  out.push('corner');
  if (n === 3) out.push('edge');
  if (n % 2 === 1 && n >= 5) out.push('midge');
  if (n >= 3) out.push('all');
  return out;
}

/** 某张分块图里,该类型贴纸是否属于图的主题(主题内才标字母;wing 图把 half-wing 一并算主题以便讲解留白)。 */
export function diagramShowsSticker(diagram: DiagramType, t: StickerType): boolean {
  if (diagram === 'all') return true;
  if (diagram === 'wing') return t === 'wing' || t === 'half-wing';
  return diagram === t;
}
