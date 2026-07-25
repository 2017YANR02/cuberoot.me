/**
 * LSLL case → 打乱(setup):把 case 状态搭成 cubing.js KPattern,
 * 两阶段求解(忽略中心)取逆,≈20 步纯面转。仅浏览器端按需加载。
 */
import { embedLsll, applyAlg, solvedCube, extractLsll, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX, type LsllState } from './cube333';
import { canonicalKey } from './model';
import { getCube3 } from '@/lib/cube3';
import { invertMoveString } from '@cuberoot/shared/alg-notation';

/**
 * 打乱取逆 = 这个 case 的一条有效解法(打乱本身就是两阶段解取的逆)。
 * 取逆把半圈变成 `-2`,渲染出来是 `F2'` —— 归一回 `F2`,与 setup 的写法一致。
 * 认不出的记号(理论上不会有,setup 是纯面转)一律给空串,调用方按「不可用」渲染。
 */
export function solutionForSetup(setup: string): string {
  if (!setup) return '';
  try {
    return invertMoveString(setup).replace(/2'/g, '2');
  } catch {
    return '';
  }
}

export async function setupForCase(state: LsllState): Promise<string> {
  const kp = await getCube3();
  const { KPattern } = await import('cubing/kpuzzle');
  const { experimentalSolve3x3x3IgnoringCenters } = await import('cubing/search');

  const full = embedLsll(state);
  const data = structuredClone(kp.defaultPattern().patternData);
  for (let i = 0; i < 8; i++) {
    data.CORNERS.pieces[CUBING_CORNER_INDEX[i]] = CUBING_CORNER_INDEX[full.cp[i]];
    data.CORNERS.orientation[CUBING_CORNER_INDEX[i]] = full.co[i];
  }
  for (let i = 0; i < 12; i++) {
    data.EDGES.pieces[CUBING_EDGE_INDEX[i]] = CUBING_EDGE_INDEX[full.ep[i]];
    data.EDGES.orientation[CUBING_EDGE_INDEX[i]] = full.eo[i];
  }
  const solution = await experimentalSolve3x3x3IgnoringCenters(new KPattern(kp, data));
  const setup = solution.invert().toString().replace(/2'/g, '2');

  // 失安全:本地模型回放 setup,确认确实到达该 case(桥接错误直接暴露)。
  const check = extractLsll(applyAlg(solvedCube(), setup));
  if ('broken' in check || canonicalKey(check.state) !== canonicalKey(state)) {
    throw new Error('setup verification failed');
  }
  return setup;
}
