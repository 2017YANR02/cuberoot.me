/**
 * F2L 插入公式池 —— 「随机 F2L 公式」这一档打乱的来源。
 *
 * 从 Dan Boharon 的 Rubik's Cube Lookahead Challenge(本页复刻对象,见
 * /about 致谢)照搬,保持题库手感一致。这些是社区标准 F2L 插入,长度 3~12 步,
 * 只用 R/L/U/F 面 —— 比等长的随机乱转更贴近实战 lookahead。
 */
export const F2L_ALGS: readonly string[] = [
  "U R U' R'", "R' F R F'", "F R' F' R", "U' R' U R", "U' F' U F", "U' L' U L",
  "F' U' F", "R' U' R", "L' U' L", "R U R'", "F U F'", "L U L'",
  "U' R U R' U2 R U' R'", "U R' U' R U2 R' U R", "U' R U2 R' U' R U2 R'",
  "U R' U2 R U2 R' U R", "U' R U' R' U F' U' F", "U' R U R' U R U R'",
  "U' R U2 R' U F' U' F", "R U' R' U R U' R' U2 R U' R'", "R' U2 R2 U R2 U R",
  "U R' U R U' R' U' R", "U' R U' R' U R U R'", "F' U F U2 R U R'",
  "R U' R' U2 F' U' F", "R U2 R' U R U R'", "R' U2 R U R' U' R",
  "U R U2 R' U R U' R'", "U' R' U2 R U' R' U R", "U2 R U R' U R U' R'",
  "U2 R' U' R U' R' U R", "U R U' R' U' R U' R' U R U' R'", "U F R' F' R U R U R'",
  "F U R U' R' F' R U' R'", "R' F' R U R U' R' F", "U' R' F R F' R U R'",
  "U R U' R' F R' F' R", "R U' R' U R U' R'", "L' U L U' L' U L",
  "R' U R U' R' U R", "R' U' R U R' U' R", "L' U' L U L' U' L",
  "R U R' U' R U R'", "U' R' F R F' R U' R'", "U R U' R' U R U' R' U R U' R'",
  "R U R' U' R U R' U' R U R'", "U' R U' R' U2 R U' R'", "U' R U2 R' U R U R'",
  "U' R U R' U F' U' F", "U F' U' F U' R U R'", "R U' R' L U2 L'",
  "R U' R' U F' L F L'", "R U R' U L U L'", "R U R' F U F'",
  "U' L' U' L R U R'", "U' R' F R F' U2 L U L'", "R U R2 U' R",
  "U' R U' R' L U' L'", "U R U R' L' U L", "U R' F R F' R' U' R",
  "U R U' R' U R U' R' L U2 L'", "U R' F R2 U' R' U2 F'", "U' F' R' U' R F",
  "U2 F R' U' R F'", "U' R U' R' F U2 F'", "U R U R' L U L'",
  "U R F U F' R'", "R U' R2 U R", "F R' U R F'", "R' U R2 U' R'",
  "L F' L' F R U' R'", "L R U2 R' L'", "R' F R2 U R' F'",
  "R U' R2 U' R U' R' U' R", "R U' R' U' R U' R' U2 L' U' L",
  "R U R' U' R U' R' U R' U' R", "R U R' U' R U' R' U' L' U' L",
  "F' R' U R U' R' U' R F", "R U' R' U' R U R' L U' L'",
  "R U' R2 U2 R U R' U2 R", "U2 R U' R' U' R' U' R", "R' F R F' L U2 L'",
  "R' F R2 U' R' U F'", "U R U R2 U2 R", "U R L' U L R'",
  "R U2 R' U R' U' R", "U2 R U' R' L' U L", "U' R U' R' F U2 F'",
];
