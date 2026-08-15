/**
 * (puzzle, set) → 顶层遮罩名。
 *
 * 两个播放器共用一份:cubing.js 的 `experimentalStickering` 和 `/sim` 引擎的阶段遮罩
 * (`engine/nxn/stickering.ts`)用的是**同一批名字**(`F2L` / `ZBLS` / `CLS` / `ZBLL` …),
 * 所以这张表不必分叉。放在单独文件里,是为了 sim 那版播放器引它时不会顺带把
 * cubing.js 拖进 bundle。
 */
import type { AlgPuzzle } from '@cuberoot/shared';

export function pickStickering(puzzle: AlgPuzzle, set: string): string | undefined {
  if (puzzle !== '3x3') return undefined;
  switch (set) {
    case 'f2l': case 'adv-f2l': case 'psf2l':     return 'F2L';
    case 'oll': case 'ollcp':                     return 'OLL';
    // 公式详情页需要看清顶层的真实配色；PLL / ZBLL 的同名阶段遮罩会把
    // U 面主贴纸压暗，只保留侧面排列信息。LL 遮罩恰好是顶层全原色、F2L 变暗。
    case 'pll': case 'anti-pll': case 'zbll': case '1lll': return 'LL';
    case 'coll':                                  return 'COLL';
    case 'cmll': case '2-look-cmll': case 'oh-cmll': return 'CMLL';
    case 'ell':                                   return 'ELL';
    case 'cls':                                   return 'CLS';
    case 'zbls':                                  return 'ZBLS';
    case 'vls':                                   return 'VLS';
    case 'wv':                                    return 'WVLS';
    case 'eo4a': case 'lse-eolr':                 return 'EO';
    case 'sv': case 'sbls': case 'fruf':          return 'LS';
    default:                                      return undefined;
  }
}
