// Ported from huazhechen/cuber (MIT) — src/cuber/define.ts
// FACE is a bidirectional const map (replaces TS enum due to erasableSyntaxOnly)
export const FACE = {
  L: 0, R: 1, D: 2, U: 3, B: 4, F: 5,
  0: "L", 1: "R", 2: "D", 3: "U", 4: "B", 5: "F",
} as const;
export type FACE = 0 | 1 | 2 | 3 | 4 | 5;

export const COLORS: { [key: string]: string } = {
  R: "#B71C1C",
  L: "#FF6D00",
  U: "#F0F0F0",
  D: "#FFD600",
  F: "#00A020",
  B: "#0D47A1",
  Core: "#202020",
  Gray: "#808080",
  High: "#FF0080",
};
