// Ported from huazhechen/cuber (MIT) — src/cuber/define.ts
// FACE is a bidirectional const map (replaces TS enum due to erasableSyntaxOnly)
export const FACE = {
  L: 0, R: 1, D: 2, U: 3, B: 4, F: 5,
  0: "L", 1: "R", 2: "D", 3: "U", 4: "B", 5: "F",
} as const;
export type FACE = 0 | 1 | 2 | 3 | 4 | 5;

// 标准 WCA 6 面色取自全站单一来源 lib/cube-colors;Core/Gray/High 是 sim 专属。
import { CUBE_FILL } from "@/lib/cube-colors";
export const COLORS: { [key: string]: string } = {
  ...CUBE_FILL,
  Core: "#202020",
  Gray: "#808080",
  High: "#FF0080",
};
