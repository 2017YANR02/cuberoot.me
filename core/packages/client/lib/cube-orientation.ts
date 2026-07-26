/**
 * 拿方朝向(csTimer `preScr`)—— 全站单一来源。
 *
 * 一个整体转前缀,描述「你把魔方拿成什么朝向」。它不改变魔方的状态,只改变
 * 哪个面显示哪种颜色:标签读作 "(<上><前>) <转体>",(UF) = 白上绿前 = 不转,
 * (DF) z2 = 黄上绿前。
 *
 * 两个消费方:
 *   - /timer 把前缀拼在打乱前面,只影响打乱图(打乱文本保持标准),见
 *     `timer/_lib/scramble/pre_scramble.ts` 里 csTimer 平价的 preScr/preScrT 两档;
 *   - /predict 不转状态,只用 `orientedFaceColors` 把颜色重贴到固定的几何面上。
 */
import type { CubeFace } from './cube-colors';

export interface CubeOrientationOption {
  /** 整体转前缀,'' = 不转(UF)。 */
  value: string;
  /** csTimer 风标签:上面色 + 前面色,再跟转体。 */
  label: string;
}

/** 24 个朝向,csTimer 顺序(cstimer.js:468)。 */
export const CUBE_ORIENTATIONS: readonly CubeOrientationOption[] = [
  { value: '',      label: '(UF)' },
  { value: 'y',     label: "(UR) y" },
  { value: 'y2',    label: '(UB) y2' },
  { value: "y'",    label: "(UL) y'" },
  { value: 'z2',    label: '(DF) z2' },
  { value: 'z2 y',  label: '(DL) z2 y' },
  { value: 'z2 y2', label: '(DB) z2 y2' },
  { value: "z2 y'", label: "(DR) z2 y'" },
  { value: "z'",    label: "(RF) z'" },
  { value: "z' y",  label: "(RD) z' y" },
  { value: "z' y2", label: "(RB) z' y2" },
  { value: "z' y'", label: "(RU) z' y'" },
  { value: 'z',     label: '(LF) z' },
  { value: 'z y',   label: '(LU) z y' },
  { value: 'z y2',  label: '(LB) z y2' },
  { value: "z y'",  label: "(LD) z y'" },
  { value: "x'",    label: "(BU) x'" },
  { value: "x' y",  label: "(BR) x' y" },
  { value: "x' y2", label: "(BD) x' y2" },
  { value: "x' y'", label: "(BL) x' y'" },
  { value: 'x',     label: '(FD) x' },
  { value: 'x y',   label: '(FR) x y' },
  { value: 'x y2',  label: '(FU) x y2' },
  { value: "x y'",  label: "(FL) x y'" },
];

/** 把朝向前缀拼到打乱前面(只给渲染用)。 */
export function applyOrientationPrefix(scramble: string, prefix: string): string {
  return prefix ? `${prefix} ${scramble}` : scramble;
}

/** 整体转把「原本在 f 面的贴纸」搬到哪个面。 */
const ROTATION_DEST: Record<'x' | 'y' | 'z', Record<CubeFace, CubeFace>> = {
  x: { F: 'U', U: 'B', B: 'D', D: 'F', R: 'R', L: 'L' },
  y: { F: 'L', L: 'B', B: 'R', R: 'F', U: 'U', D: 'D' },
  z: { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' },
};

const IDENTITY_COLORS: Record<CubeFace, CubeFace> = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };

/**
 * 朝向前缀 → 「几何面 f 上看到的是哪个面的颜色」。
 *
 * (UF) 是恒等;z2 下 U 面看到 D 的颜色(黄),D 面看到 U 的颜色(白)。因为
 * 只是重贴颜色、不动状态,这张表对打乱过的魔方同样成立:一枚本位在 c 面的
 * 贴纸,不论转到哪儿,永远画成 `orientedFaceColors(prefix)[c]` 的颜色。
 *
 * 非法 token 静默跳过(前缀只可能来自 CUBE_ORIENTATIONS)。
 */
export function orientedFaceColors(prefix: string): Record<CubeFace, CubeFace> {
  let shown: Record<CubeFace, CubeFace> = { ...IDENTITY_COLORS };
  for (const token of prefix.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([xyz])(2|')?$/.exec(token);
    if (!m) continue;
    const dest = ROTATION_DEST[m[1] as 'x' | 'y' | 'z'];
    const times = m[2] === '2' ? 2 : m[2] === "'" ? 3 : 1;
    for (let t = 0; t < times; t++) {
      const next = {} as Record<CubeFace, CubeFace>;
      for (const f of Object.keys(shown) as CubeFace[]) next[dest[f]] = shown[f];
      shown = next;
    }
  }
  return shown;
}

/** `orientedFaceColors` 的逆:某个颜色现在贴在哪个几何面上。 */
export function faceShowingColor(shown: Record<CubeFace, CubeFace>, color: CubeFace): CubeFace {
  for (const f of Object.keys(shown) as CubeFace[]) if (shown[f] === color) return f;
  return color;
}
