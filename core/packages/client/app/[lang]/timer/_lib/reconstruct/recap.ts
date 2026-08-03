/**
 * 「这把要不要就地摊开复盘?」—— 停表那一刻的唯一判据。
 *
 * 抽成函数是因为它有两个调用方(SoloView 决定要不要挂那块,设置里那个开关的文案
 * 要说清它对谁生效),而答案错了不是显示 bug 是打扰:手动计时的成绩根本没有可复盘
 * 的东西,却让复盘顶掉半屏,那是每把都要点一下收起。
 */

import type { Solve } from '../types';
import type { TimerSettings } from '../settings';

/**
 * 刚记下的这把该不该自动展开复盘。
 *
 * - 开关关掉 → 永远不展开(仍可从成绩里点开)。
 * - 没有动作流 → 不展开。报告的每一个数(TPS / 分阶段 / 质量 / 回放)都从动作流来,
 *   没有它剩下的只是一个已经显示在读数上的时间。
 *
 * 判定不看惩罚:DNF 那把恰恰是最值得看「在哪崩的」的一把。
 */
export function shouldAutoRecap(
  solve: Pick<Solve, 'moves'>,
  settings: Pick<TimerSettings, 'autoRecap'>,
): boolean {
  if (settings.autoRecap === false) return false;
  return (solve.moves?.length ?? 0) > 0;
}
