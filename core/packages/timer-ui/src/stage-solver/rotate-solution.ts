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
import { normalize } from '@cuberoot/shared/recon-ground-truth';
import { simplifyAlg } from '@cuberoot/shared/recon/cube3';

// 可见预转体 y^n(n=0..3):无 / y / y2 / y'
const Y_PREFIX = ['', 'y', 'y2', "y'"] as const;

/** Rank orientations by R+L, then F-B, then R-L (all descending).
 * U/D and rotations are neutral; each half turn counts once. Ties keep the first candidate.
 */
export function bestErgonomicOrientationIndex(candidates: readonly string[]): number {
  let best = -1, bestScore = [-Infinity, -Infinity, -Infinity];
  candidates.forEach((alg, index) => {
    let R = 0, L = 0, F = 0, B = 0;
    for (const token of alg.trim().split(/\s+/)) {
      const face = token[0];
      if (face === 'R') R++; else if (face === 'L') L++;
      else if (face === 'F') F++; else if (face === 'B') B++;
    }
    const score = [R + L, F - B, R - L];
    const difference = score.findIndex((value, i) => value !== bestScore[i]);
    if (difference >= 0 && score[difference] > bestScore[difference]) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

/** Rewrite moves in a rotated frame: inverse(rotation) · alg · rotation.
 * With a face-turn-only alg the result contains no whole-cube rotations.
 * Supports x/y/z, including z2 and composed frames, through the shared normalizer.
 */
export function rotateMovesToFrame(alg: string, rotation: string): string {
  const frame = rotation.trim().split(/\s+/).filter(Boolean);
  if (frame.some(move => !/^[xyz](?:2|')?$/.test(move))) throw new Error('Invalid rotation frame');
  if (!frame.length) return alg.trim();
  const inverse = frame.slice().reverse().map(move => move.endsWith('2') ? move : move.endsWith("'") ? move[0] : move + "'");
  return normalize([...inverse, ...alg.trim().split(/\s+/).filter(Boolean), ...frame]).join(' ');
}

/** Current rotation only; the UI supplies a separate zero-state control label. */
export const Y_ROT_LABEL = ['', 'y', 'y2', "y'"] as const;

/**
 * @param alg  原始解法(空格分隔,通常纯单层面转,也容忍含前导旋转)
 * @param n    预转体次数 0..3(会取模);0 仅合并前导转体
 *
 * 解法开头若带朝向前缀(如 `z` / `x'` / `x' y`,= 选面视角的整体旋转),y 预转体作用在
 * **该前缀之后**(显示成 `z y …` 而非 `y z …`):只对其后的实际转动重写朝向,
 * 再合并前缀中相邻的同轴转体(如 `y y2` → `y'`, `y y'` → 无)。
 */
export function rotateSolutionY(alg: string, n: number): string {
  const k = ((Math.trunc(n) % 4) + 4) % 4;
  const body = alg.trim();
  if (!body) return body;
  // 剥离开头连续的整体旋转 token(x/y/z ± 2/'),y 预转体插在它们之后。
  const all = body.split(/\s+/);
  let p = 0;
  while (p < all.length && /^[xyz][2']?$/.test(all[p])) p++;
  const prefix = all.slice(0, p);
  const moves = all.slice(p);
  if (moves.length === 0) return simplifyAlg(body); // 全是旋转,无实际转动可重写
  const relabeled = k === 0 ? moves.join(' ') : rotateMovesToFrame(moves.join(' '), Y_PREFIX[k]);
  const rotation = simplifyAlg([...prefix, Y_PREFIX[k]].filter(Boolean).join(' '));
  return [rotation, relabeled].filter(Boolean).join(' ');
}
