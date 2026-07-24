/**
 * 33 种对称类型各一个代表状态(从复原态拧出该状态的公式)。
 *
 * 绝大多数取自 Cube Explorer 文档里的经典短公式(同一份表也用在
 * D:\cube\solver_wip\tools\symmetry\symmetry.cpp 的自检里);Ci 那条是本站
 * 搜索引擎跑出来后用 two-phase 求最短得到的。
 *
 * O 与 Td 两类没有代表:不存在对称群"恰好"等于它们的魔方状态 —— 任何同时具有
 * 这 24 个元素的状态,一定连剩下 24 个也一起具有,于是落进 Oh。
 * (tests/symmetry_examples.test.ts 会逐条重算验证。)
 */

export interface SymExample {
  /** 对称类型名(对应 SYM_TYPES[i].name)。 */
  name: string;
  /** 生成公式;null = 该类型不存在代表状态。 */
  alg: string | null;
  /** 图案的俗名(有的话)。 */
  label?: { zh: string; en: string };
}

export const SYM_EXAMPLES: SymExample[] = [
  { name: 'Oh', alg: 'U2 D2 R2 L2 F2 B2', label: { zh: '六面点', en: 'Six spots' } },
  { name: 'O', alg: null },
  { name: 'Td', alg: null },
  { name: 'D3d', alg: "U L D U L' D' U' R B2 U2 B2 L' R' U'" },
  { name: 'Th', alg: 'U2 L2 F2 D2 U2 F2 R2 U2' },
  { name: 'C3v', alg: "U L' R' B2 U' R2 B L2 D' F2 L' R' U'" },
  { name: 'T', alg: "B F L R B' F' D' U' L R D U" },
  { name: 'D4h', alg: 'U2 D2', label: { zh: '双层棋盘', en: 'Two-layer checker' } },
  { name: 'D3', alg: "D B D U2 B2 F2 L2 R2 U' F U" },
  { name: 'D4', alg: 'U D' },
  { name: 'D2d(face)', alg: "U R L F2 B2 R' L' U" },
  { name: 'C4v', alg: 'D2' },
  { name: 'C4h', alg: "U D'" },
  { name: 'D2h(edge)', alg: 'U R2 L2 D2 F2 B2 U' },
  { name: 'D2d(edge)', alg: 'U F2 B2 D2 F2 B2 U' },
  { name: 'S6', alg: "B' D' U L' R B' F U" },
  { name: 'D2h(face)', alg: 'B2 D2 U2 F2' },
  { name: 'C2v(a1)', alg: "U R2 L2 U2 F2 B2 U'" },
  { name: 'C2v(b)', alg: 'B2 R2 B2 R2 B2 R2' },
  { name: 'C2h(b)', alg: 'U R2 U D R2 D' },
  { name: 'D2(edge)', alg: 'U F2 U2 D2 F2 D' },
  { name: 'C4', alg: 'D' },
  { name: 'D2(face)', alg: 'R2 L2 F B' },
  { name: 'S4', alg: 'U R2 L2 U2 R2 L2 D' },
  { name: 'C2h(a)', alg: "U' D F2 B2" },
  { name: 'C2v(a2)', alg: 'R2 L2 U2' },
  { name: 'C3', alg: "L' R U2 R2 D2 F2 L R D2" },
  { name: 'Cs(b)', alg: "U B2 U D B2 D'" },
  { name: 'C2(b)', alg: "U R2 D' U' R2 U'" },
  { name: 'C2(a)', alg: 'L R U2' },
  { name: 'Cs(a)', alg: 'F2 R2' },
  { name: 'Ci', alg: 'B2 R2 D2 R2 D2 R2 U2 F2 D2 U2' },
  { name: 'C1', alg: "R U R' U'", label: { zh: '右手小三角', en: 'Sexy move' } },
];

/** 另一个广为人知的 Oh 状态:超级翻(全部 12 条棱翻转)。 */
export const SUPERFLIP = "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U";
