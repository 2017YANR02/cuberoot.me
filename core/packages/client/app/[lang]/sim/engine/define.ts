// Ported from huazhechen/cuber (MIT) — src/cuber/define.ts
// FACE is a bidirectional const map (replaces TS enum due to erasableSyntaxOnly)
export const FACE = {
  L: 0, R: 1, D: 2, U: 3, B: 4, F: 5,
  0: "L", 1: "R", 2: "D", 3: "U", 4: "B", 5: "F",
} as const;
export type FACE = 0 | 1 | 2 | 3 | 4 | 5;

/** Unit cubelet edge length — the universal scale for the whole engine (camera
 *  distance, light positions, face-hint offsets, every puzzle's geometry). Lives
 *  here (not on the NxN Cubelet class) so the non-NxN engines + world + face_hints
 *  read the scale without importing the NxN piece. Cubelet.SIZE re-exports it. */
export const SIZE = 64;

/** Sticker 内缩几何 —— 彩色贴片每边从 cubelet 面内缩 BORDER + ½·EDGE,露出的深色 frame 即
 *  facelet 之间的黑缝。**唯一源**:`Cubelet._STICKER` 与原核(`rawCore`)黑缝内缩都从这里派生,
 *  保证「六色贴片缝宽 == 原核黑缝宽」。别在别处再抄一份边宽常量(抄一份就会 desync)。 */
export const STICKER_BORDER_WIDTH = 3;
export const STICKER_EDGE_WIDTH = 2;
/** 内贴片边长 = SIZE - 2*BORDER - EDGE(SIZE 64 时 = 56);半宽 = 28。 */
export const STICKER_INNER = SIZE - 2 * STICKER_BORDER_WIDTH - STICKER_EDGE_WIDTH;
/** 贴片圆角半径 = (半宽)/4 = STICKER_INNER/8(= makeStickerShape 的 `radius=size/4`)。
 *  唯一源:`Cubelet` 贴片几何与原核黑缝 SDF 都用它,保证原核贴片圆角 == 六色贴片圆角。 */
export const STICKER_CORNER_RADIUS = STICKER_INNER / 8;

// 标准 WCA 6 面色取自全站单一来源 lib/cube-colors;Core/Gray/Blank/High 是 sim 专属。
import { CUBE_FILL } from "@/lib/cube-colors";
export const COLORS: { [key: string]: string } = {
  ...CUBE_FILL,
  Core: "#202020",
  Gray: "#808080",
  // 「这一格没有身份,只是个可点的空格」——/predict 只亮目标块、整盘其余全是它,
  // 比 Gray 压得暗,亮色才跳得出来;又要明显亮过块身 Core,不然格子边界没了、点不准。
  // 阶段遮罩那档「与本阶段无关」的灰是另一回事(#666666,在 instanced.resolveStickerColor),
  // 那是「有颜色但不相干」,盘上大多数贴纸仍是彩的,别把两者并成一个常量。
  Blank: "#4a4a4a",
  High: "#FF0080",
};
