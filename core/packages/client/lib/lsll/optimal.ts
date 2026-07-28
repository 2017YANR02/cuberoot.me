/**
 * LSLL case → 后台管道算好的整方 HTM 最优解(表 `lsll_cases`,端点 `/v1/alg/lsll/case/:key`)。
 *
 * 拿它当**打乱**用:最优解取逆就是把这个 case 摆出来的最短转法。所以只要这个 case 已回填,
 * 打乱就是 ≈14 步的最优,而不是现算两阶段解那 ≈20 步(`./setup`,机器解、不优化步数)。
 *
 * 相位对得上是有来由的、不是巧合:语料里每条打乱都是照 `model.displayState` 造的(`scripts/lsll-corpus.mts`
 * 逐条回放验过),求解器解的就是那条打乱,所以「最优解取逆」落回的正是 case 图上那一个相位。
 * 即便如此,这里仍照 `setupForCase` 的规矩本地回放校验一次 —— 只用 cube333 纯 TS 模型,不碰 cubing.js,
 * 一次几十微秒。验不过就返 null,由调用方退回现算,绝不把摆不出这个 case 的打乱端给用户。
 */
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { apiUrl } from '@/lib/api-base';
import { applyAlg, extractLsll, solvedCube, type LsllState } from './cube333';
import { keyToString, packState } from './model';

export interface LsllOptimal {
  /** 摆出这个 case 的打乱(= 最优解取逆)。 */
  setup: string;
  /** 最优解本身,连同它的步数 —— 训练器「揭示」和 case 页都直接用。 */
  alg: string;
  htm: number;
}

/**
 * 最优解 → 摆出这个 case 的打乱。`want` 是 {@link displayState} 摆正后的状态。
 * 本地回放验不过(相位差一个 AUF、记号认不出、解本身坏了)一律返 `null` —— 调用方退回现算。
 */
export function setupFromOptimalAlg(alg: string, want: LsllState): string | null {
  if (!alg) return null;
  let setup: string;
  try {
    // 取逆把半圈写成 `-2`(渲染成 `F2'`)—— 归一回 `F2`,与 setup 的写法一致。
    setup = invertMoveString(alg).replace(/2'/g, '2');
  } catch {
    return null;
  }
  const check = extractLsll(applyAlg(solvedCube(), setup));
  if ('broken' in check || packState(check.state) !== packState(want)) return null;
  return setup;
}

/** 同一个 key 的并发请求合成一发;`null` = 问过了没有(未回填 / 端点不在),别再问第二遍。 */
const CACHE = new Map<number, LsllOptimal | null>();
const INFLIGHT = new Map<number, Promise<LsllOptimal | null>>();

async function load(key: number, want: LsllState): Promise<LsllOptimal | null> {
  let d: { status?: string; htm?: number; algs?: unknown };
  try {
    const r = await fetch(apiUrl(`/v1/alg/lsll/case/${keyToString(key)}`));
    // 404 = 这个环境没部署这个端点;非 ok 一律当「没有」,调用方自己现算。
    if (!r.ok) return null;
    d = await r.json();
  } catch {
    return null;
  }
  const alg = d.status === 'ok' && Array.isArray(d.algs) ? String(d.algs[0] ?? '') : '';
  const setup = setupFromOptimalAlg(alg, want);
  if (!setup) return null;
  return { setup, alg, htm: typeof d.htm === 'number' ? d.htm : alg.split(/\s+/).filter(Boolean).length };
}

/**
 * 这个 case 的最优解(带打乱)。`want` 传 {@link displayState} 摆正后的状态 —— 校验按它比。
 * 还没回填 / 拿不到 / 验不过都返 `null`,调用方退回 `./setup` 现算。
 */
export function lsllOptimal(key: number, want: LsllState): Promise<LsllOptimal | null> {
  const hit = CACHE.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const flying = INFLIGHT.get(key);
  if (flying) return flying;
  const p = load(key, want)
    .catch(() => null)
    .then((v) => { CACHE.set(key, v); INFLIGHT.delete(key); return v; });
  INFLIGHT.set(key, p);
  return p;
}
