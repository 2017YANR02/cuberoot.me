// 三阶标准配色 — 全站单一来源。值对齐 @cuberoot/visualcube 的 ColorCode。
// 朝向约定:U=白 D=黄 F=绿 B=蓝 R=红 L=橙(见 lib/cross-solver)。
// 视角格 / 3D 贴纸 / 色块 / gen 步数徽标 都从这里取色,别再各页硬码。

export type CubeFace = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';

/** 贴纸实心填充色(视角格、3D、色块);深浅主题一致。 */
export const CUBE_FILL: Record<CubeFace, string> = {
  U: '#FFFFFF',
  D: '#FEFE00',
  F: '#00D800',
  B: '#0000F2',
  L: '#FFA100',
  R: '#EE0000',
};

/** 填充之上的可读字色(白/黄/绿/橙用深字,红/蓝用白字)。 */
export const CUBE_ON_FILL: Record<CubeFace, string> = {
  U: '#171717',
  D: '#171717',
  F: '#171717',
  B: '#ffffff',
  L: '#171717',
  R: '#ffffff',
};

// gen 步数徽标 6 列顺序(BADGE_ORDER = White Yellow Red Orange Blue Green)对应的面,
// 与 useStepMap.ts 的 BADGE_TO_FACE 一致。
export const BADGE_FACE_ORDER: CubeFace[] = ['U', 'D', 'R', 'L', 'B', 'F'];
