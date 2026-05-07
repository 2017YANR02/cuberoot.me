/**
 * Inline animated cube preview — wraps cubing.js TwistyPlayer.
 *
 * Lazy-imports cubing/twisty(~150 KB),所以仅在真正用到时才加载。
 * 接受 (alg, puzzle, set, setup),挂载到一个 div 容器里。
 *
 * 提供给两处用:
 *  - AlgCategoryPage:用户点击公式行展开后播放
 *  - AlgEditor (admin):编辑时显示当前 focused 行的预览,核对公式
 */
import { useEffect, useRef } from 'react';
import type { AlgPuzzle } from '@cuberoot/shared';

/** Map our AlgPuzzle slug to cubing.js's TwistyPlayer puzzle id. */
export const TWISTY_PUZZLE: Record<AlgPuzzle, string> = {
  '2x2': '2x2x2',
  '3x3': '3x3x3',
  '4x4': '4x4x4',
  '5x5': '5x5x5',
  'sq1': 'square1',
  'megaminx': 'megaminx',
  'pyraminx': 'pyraminx',
  'skewb': 'skewb',
};

/** SQ1 alg `1,0/-1,0` → `(1,0)/(-1,0)`. cubing.js parser 需要每个 m,n move 加括号。 */
export function normalizeAlgForTwisty(puzzle: AlgPuzzle, alg: string): string {
  if (puzzle !== 'sq1') return alg;
  return alg.replace(/(-?\d+,-?\d+)/g, '($1)');
}

/** Map our (puzzle, set) to a cubing.js experimentalStickering value (LL/LS grayed out). */
export function pickStickering(puzzle: AlgPuzzle, set: string): string | undefined {
  if (puzzle !== '3x3') return undefined;
  switch (set) {
    case 'f2l': case 'adv-f2l':                   return 'F2L';
    case 'oll': case 'ollcp':                     return 'OLL';
    case 'pll': case 'anti-pll':                  return 'PLL';
    case 'coll':                                  return 'COLL';
    case 'cmll':                                  return 'CMLL';
    case 'ell':                                   return 'ELL';
    case 'cls':                                   return 'CLS';
    case 'zbls':                                  return 'ZBLS';
    case 'vls':                                   return 'VLS';
    case 'wv':                                    return 'WVLS';
    case 'zbll':                                  return 'ZBLL';
    case '1lll':                                  return 'LL';
    case 'eo4a':                                  return 'EO';
    case 'sv': case 'sbls': case 'fruf':          return 'LS';
    default:                                      return undefined;
  }
}

interface Props {
  alg: string;
  puzzle: AlgPuzzle;
  set: string;
  setup?: string;
  /** 自定义尺寸,默认 260px */
  size?: number;
}

export default function AlgPlayer({ alg, puzzle, set, setup, size = 260 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;
    const normalized = normalizeAlgForTwisty(puzzle, alg);
    const stickering = pickStickering(puzzle, set);
    // 优先用 setup(rotation-free),否则用 alg 的 inverse(可能带 rotation)
    const setupForTwisty = setup && setup.trim()
      ? normalizeAlgForTwisty(puzzle, setup)
      : `(${normalized})'`;
    import('cubing/twisty').then((mod) => {
      if (cancelled || !host) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (mod as any).TwistyPlayer || (mod as any).default;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts: any = {
          puzzle: TWISTY_PUZZLE[puzzle],
          experimentalSetupAlg: setupForTwisty,
          alg: normalized,
          controlPanel: 'bottom-row',
          background: 'none',
          hintFacelets: 'none',
          backView: 'none',
        };
        if (stickering) opts.experimentalStickering = stickering;
        player = new Ctor(opts);
        player.style.colorScheme = 'light';
        player.style.width = size + 'px';
        player.style.height = size + 'px';
        host.appendChild(player);
      } catch (err) {
        console.warn(`[AlgPlayer] ${puzzle} alg failed: ${alg}`, err);
        host.innerHTML = `<div style="font-size:12px;color:#888;padding:8px">player unavailable</div>`;
      }
    }).catch(err => console.warn('Failed to load cubing library:', err));
    return () => {
      cancelled = true;
      if (player && host.contains(player)) host.removeChild(player);
    };
  }, [alg, puzzle, set, setup, size]);
  return <div ref={hostRef} className="alg-twisty-host" />;
}
