/**
 * 「这颗魔方现在的样子,是从复原态怎么拧出来的」—— 一段公式。
 *
 * ## 为什么需要它
 *
 * 屏幕上那颗 3D 魔方是**公式驱动**的:引擎没有「直接设置贴纸」的入口,只能从复原态
 * 起把一段公式重放一遍。所以实时镜像一直靠 `liveMoves`(上次看到魔方复原之后拧的
 * 每一手)来画。
 *
 * 这在「连上时魔方是复原的」那条路上够用。但你要是**连上一颗已经打乱的魔方**,
 * 这条日志就没有起点 —— 谁也不知道它是怎么变成这样的。原来的做法是退回平面展开图,
 * 等你先还原一次才肯上 3D。等于说:第一把永远看不到会转的魔方。
 *
 * 缺的不是渲染,是**信息**:从复原态到当前状态那一段。而这段信息其实拿得到 ——
 * 魔方自己会报当前每一块贴纸的颜色,站里也有两阶段求解器。算出来接在日志最前面,
 * 3D 立刻就能上,一手都不用先拧。
 *
 * ## 方向别搞反
 *
 * `solve333(X)` 给的是**生成** X 的那一串,不是解开 X 的解法(`scramble_fixup.ts`
 * 里就是这么用的:`from⁻¹·target` 喂进去,得到的是从 `from` 拧到 `target` 的路)。
 * 所以这里直接把当前状态喂进去就是要的东西,不用取逆。
 *
 * ## 失安全:算完必须验
 *
 * 贴纸串 → 块级状态那一步跨了三套下标约定(魔方协议、`lib/cube-facelet` 的
 * cstimer 序、求解器自己的)。约定错一个位,出来的仍然是一串合法转动,只是画出来的
 * 是**另一颗魔方** —— 而且看起来一切正常,直到你发现屏幕和手里对不上。
 *
 * 所以算完拿 timer 自己的贴纸模型把它重放一遍,和目标逐格比,不一致就整个作废
 * (退回平面图)。少一次 3D 是小事,画一颗没人验证过的魔方不是。
 */

import { faceletToCubie, validateFacelet, type CubieCube } from '@/lib/cube-facelet';
import { applyScramble, toFaceletString } from '../cube/state';
import { solve333 } from '../scramble/kociemba/random_state';

/** 复原态那 54 个字符。 */
const SOLVED = toFaceletString(applyScramble(3, ''));

/**
 * 求解器。默认走 timer 自己那台两阶段(worker 里跑,表已经被打乱生成器焐热了,
 * 通常 50-200ms)。作为参数是为了能在测试里换掉 —— `scramble_fixup.ts` 的
 * `FixupDeps.solve` 是同一个路子。
 */
export type Solve333 = (state: CubieCube) => Promise<string>;

/**
 * 从复原态到 `facelets` 的一段公式,拆成记号数组。
 *
 * - 已经是复原态 → `[]`(不惊动求解器)。
 * - 贴纸串读不动 / 状态物理上不可能 / 求解器抛了 / **验算没过** → `null`,
 *   调用方据此不上 3D。
 */
export async function anchorAlgFor(
  facelets: string,
  solve: Solve333 = solve333,
): Promise<string[] | null> {
  const s = facelets.toUpperCase();
  if (validateFacelet(s) !== null) return null;
  if (s === SOLVED) return [];

  let alg: string;
  try {
    alg = await solve(faceletToCubie(s));
  } catch {
    return null;
  }

  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // 验算:把它重放一遍,必须**逐格**等于目标。
  let reached: string;
  try {
    reached = toFaceletString(applyScramble(3, tokens.join(' ')));
  } catch {
    return null;
  }
  return reached === s ? tokens : null;
}
