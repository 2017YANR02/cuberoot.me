'use client';

/**
 * Inline animated cube preview — wraps cubing.js TwistyPlayer.
 *
 * Lazy-imports cubing/twisty(~150 KB),所以仅在真正用到时才加载。
 * 接受 (alg, puzzle, set, setup),挂载到一个 div 容器里。
 *
 * 提供给两处用:
 *  - AlgCategoryView:用户点击公式行展开后播放
 *  - AlgEditor (admin):编辑时显示当前 focused 行的预览,核对公式
 */
import { useEffect, useRef, useImperativeHandle, forwardRef, type CSSProperties } from 'react';
import type { AlgPuzzle } from '@cuberoot/shared';
import { canonicalSq1Alg } from '@/lib/sq1-svg';

export interface AlgPlayerHandle {
  /** 拿到底层 cubing.js TwistyPlayer 实例,给光标 sync 等高级用法用 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPlayer(): any | null;
}

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

/** SQ1 alg → canonical `(t,b)/(t,b)/...` for cubing.js TwistyPlayer.
 *  Accepts any input form (parens / commas / spaces all optional, e.g. `10/3-3/-21`). */
export function normalizeAlgForTwisty(puzzle: AlgPuzzle, alg: string): string {
  if (puzzle !== 'sq1') return alg;
  return canonicalSq1Alg(alg);
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
  /** 自定义尺寸,默认 260px;`fillPane=true` 时忽略 */
  size?: number;
  /** 撑满父容器(用 ResizeObserver 把像素尺寸直接写入 player),否则用 size 固定方形 */
  fillPane?: boolean;
}

const AlgPlayer = forwardRef<AlgPlayerHandle, Props>(function AlgPlayer({ alg, puzzle, set, setup, size = 260, fillPane = false }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  useImperativeHandle(ref, () => ({ getPlayer: () => playerRef.current }), []);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;
    let ro: ResizeObserver | null = null;
    const normalized = normalizeAlgForTwisty(puzzle, alg);
    const stickering = pickStickering(puzzle, set);
    // 优先用 setup(rotation-free),否则用 alg 的 inverse(可能带 rotation)
    const setupForTwisty = setup && setup.trim()
      ? normalizeAlgForTwisty(puzzle, setup)
      : `(${normalized})'`;
    // NOTE: 播的是库里的完整公式(含收尾 AUF),动画才停在还原态。前端只在**显示/复制**时
    // 用 displayAlg() 剥掉那个 AUF —— 别把 displayAlg 的结果传进来。
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
        if (fillPane) {
          // ResizeObserver 把 host 像素尺寸写到 player,WebGL canvas 才会重绘
          const syncSize = () => {
            const w = host.offsetWidth;
            const h = host.offsetHeight;
            if (w > 0 && h > 0) {
              player.style.width = `${w}px`;
              player.style.height = `${h}px`;
            }
          };
          syncSize();
          ro = new ResizeObserver(syncSize);
          ro.observe(host);
        } else {
          player.style.width = size + 'px';
          player.style.height = size + 'px';
        }
        host.appendChild(player);
        playerRef.current = player;
      } catch (err) {
        console.warn(`[AlgPlayer] ${puzzle} alg failed: ${alg}`, err);
        host.innerHTML = `<div style="font-size:12px;color:#888;padding:8px">player unavailable</div>`;
      }
    }).catch(err => console.warn('Failed to load cubing library:', err));
    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (player && host.contains(player)) host.removeChild(player);
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [alg, puzzle, set, setup, size, fillPane]);
  // NOTE: 固定 host 尺寸,player 重 mount 时容器占位不丢,父布局不抖
  const hostStyle: CSSProperties = fillPane
    ? { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    : { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return <div ref={hostRef} className="alg-twisty-host" style={hostStyle} />;
});

export default AlgPlayer;
