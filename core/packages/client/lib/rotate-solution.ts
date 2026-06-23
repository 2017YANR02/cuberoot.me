/**
 * 给一条解法加 y 预转体(pre-rotation),并把后续转动按新朝向重写,使「同一个解」
 * 在转体后的握法下仍解出同一个十字(整方块末态多转一个 y^n,不影响十字)。
 *
 * 用途:/scramble StageSolver 每条十字解法旁的「y」按钮,循环 0 → y → y2 → y' → 0,
 * 让用户在不同朝向下做同一套公式。
 *
 * 原理:目标 = 一条以 y^n 开头、整体效果等价于 `A · y^n` 的解。
 *   y^n · R          (R = 重写后的转动)
 *   要 R ≡ y^{-n} · A · y^n  →  R = normalize(y^{-n} A y^n)(纯单层面转,旋转抵消)
 *   故 显示 = y^n + normalize(y^{-n} A y^n)
 * 复用 recon 的 normalize(同一套朝向状态机,已在复盘十字标准化中生产验证)。
 */
import { normalize } from '@/lib/recon-norm-cross';

// 可见预转体 y^n(n=0..3):无 / y / y2 / y'
const Y_PREFIX = ['', 'y', 'y2', "y'"] as const;
// 内部 y^{-n}:无 / y'(y⁻¹) / y2(y⁻²) / y(y⁻³=y)
const Y_INV = ['', "y'", 'y2', 'y'] as const;

/** 按钮当前态文本(0 态用 'y' 提示可加)。 */
export const Y_ROT_LABEL = ['y', 'y', 'y2', "y'"] as const;

/**
 * @param alg  原始解法(空格分隔,通常纯单层面转,也容忍含前导旋转)
 * @param n    预转体次数 0..3(会取模);0 原样返回
 *
 * 解法开头若带朝向前缀(如 `z` / `x'` / `x' y`,= 选面视角的整体旋转),y 预转体作用在
 * **该前缀之后**(显示成 `z y …` 而非 `y z …`):前缀原样保留,只对其后的实际转动重写朝向。
 */
export function rotateSolutionY(alg: string, n: number): string {
  const k = ((Math.trunc(n) % 4) + 4) % 4;
  const body = alg.trim();
  if (k === 0 || !body) return body;
  // 剥离开头连续的整体旋转 token(x/y/z ± 2/'),y 预转体插在它们之后。
  const all = body.split(/\s+/);
  let p = 0;
  while (p < all.length && /^[xyz][2']?$/.test(all[p])) p++;
  const prefix = all.slice(0, p);
  const moves = all.slice(p);
  if (moves.length === 0) return body; // 全是旋转,无实际转动可重写
  const tokens = `${Y_INV[k]} ${moves.join(' ')} ${Y_PREFIX[k]}`.trim().split(/\s+/);
  const relabeled = normalize(tokens);
  return [...prefix, Y_PREFIX[k], ...relabeled].join(' ').trim();
}
