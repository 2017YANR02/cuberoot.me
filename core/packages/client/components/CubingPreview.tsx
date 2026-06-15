'use client';

/**
 * Shared scramble preview component used by /timer and /battle.
 *
 * Renders a 2D scramble preview using cubing.js TwistyPlayer for most events.
 * Square-1 and Megaminx use our tnoodle-port SVG renderers (cubing.js 2D for
 * those is incomplete/inaccurate for unfolded views). Bypasses the
 * scramble-display npm package so we don't add an extra dep.
 *
 * Accepts both timer-side EventIds (mega/pyra/333bld/...) and battle/WCA-style
 * ids (minx/pyram/333bf/...).
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from '@/app/[lang]/scramble/gen/_svg/sq1_svg';
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from '@/app/[lang]/scramble/gen/_svg/mega_svg';

interface CubingPreviewProps {
  /** Either a timer EventId or a WCA-style id (e.g. 'minx', 'pyram'). */
  event: string;
  scramble: string;
  /** Base unit (px). Final width/height is `size * facelets`. */
  size?: number;
  /** When set, fixes the rendered HEIGHT and derives width from each puzzle's
   *  natural aspect (via CSS aspect-ratio) — so every event previews at the
   *  same height (a 7x7 just gets smaller facelets). A number is px; a string
   *  is any CSS length (e.g. 'min(28vw, 26dvh, 260px)') for fluid sizing.
   *  Overrides `size`. */
  height?: number | string;
  className?: string;
  /** TwistyPlayer visualization mode. Defaults to '2D'. Inline-SVG puzzles
   *  (sq1 / mega) ignore this and always render 2D. */
  visualization?: '2D' | '3D';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwistyPlayerCtor = new (init: Record<string, unknown>) => any;

interface PuzzleSpec {
  /** cubing.js puzzle id (only used when we go through TwistyPlayer). */
  cubingPuzzle: string | null;
  /** Inline SVG renderer; overrides TwistyPlayer when present. */
  inlineSvg?: 'sq1' | 'mega';
  /** Unit multipliers for width/height (units of `size`). */
  w: number;
  h: number;
}

/**
 * Maps any incoming event id to a render plan. Returns null for unknown ids
 * (component then renders nothing). For BLD/OH/FM variants we just fall
 * through to the underlying NxN cube — the scramble alg is identical.
 */
function planFor(event: string): PuzzleSpec | null {
  switch (event) {
    case '222':                                  return { cubingPuzzle: '2x2x2',     w: 8,  h: 6 };
    case '333': case '333oh': case '333fm':
    case '333bld': case '333bf': case '333mr':
    case '333ni': case '333mbld': case '333mbf': return { cubingPuzzle: '3x3x3',     w: 12, h: 9 };
    case '444': case '444bld': case '444bf':     return { cubingPuzzle: '4x4x4',     w: 16, h: 12 };
    case '555': case '555bld': case '555bf':     return { cubingPuzzle: '5x5x5',     w: 20, h: 15 };
    case '666':                                  return { cubingPuzzle: '6x6x6',     w: 24, h: 18 };
    case '777':                                  return { cubingPuzzle: '7x7x7',     w: 28, h: 21 };
    case 'clock':                                return { cubingPuzzle: 'clock',     w: 14, h: 7 };
    case 'pyra': case 'pyram':                   return { cubingPuzzle: 'pyraminx',  w: 12, h: 10 };
    case 'skewb':                                return { cubingPuzzle: 'skewb',     w: 12, h: 9 };
    case 'fto':                                  return { cubingPuzzle: 'fto',       w: 16, h: 12 };
    case 'kilominx':                             return { cubingPuzzle: 'kilominx',  w: 18, h: 14 };
    // sq1 / mega — use our inline renderers (cubing.js 2D for sq1 is broken;
    // mega unfolded view differs from tnoodle).
    case 'sq1':                                  return { cubingPuzzle: null, inlineSvg: 'sq1',  w: 7,  h: 14 };
    case 'mega': case 'minx':                    return { cubingPuzzle: null, inlineSvg: 'mega', w: 17, h: 8 };
    // Relays / custom / unknown — hide.
    case 'r3': case 'r4': case 'r5': case 'custom':
    default:                                     return null;
  }
}

export default function CubingPreview({ event, scramble, size = 14, height, className, visualization = '2D' }: CubingPreviewProps) {
  const plan = planFor(event);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [Ctor, setCtor] = useState<TwistyPlayerCtor | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Inline-SVG renderers — sq1/mega bypass cubing.js entirely.
  const portedSvg = useMemo(() => {
    if (!plan?.inlineSvg) return null;
    try {
      if (plan.inlineSvg === 'sq1')  return renderSq1ScrambleSvg(scramble ?? '', DEFAULT_SQ1_COLORS);
      if (plan.inlineSvg === 'mega') return renderMegaScrambleSvg(scramble ?? '', DEFAULT_MEGA_COLORS);
    } catch (err) {
      console.warn(`[CubingPreview] ${plan.inlineSvg} render failed`, err);
    }
    return null;
  }, [plan, scramble]);

  // Lazy-load cubing/twisty only when we actually need it.
  useEffect(() => {
    if (Ctor || !plan?.cubingPuzzle) return;
    let cancelled = false;
    import('cubing/twisty').then((mod) => {
      if (cancelled) return;
      const C = (mod as unknown as { TwistyPlayer?: TwistyPlayerCtor; default?: TwistyPlayerCtor }).TwistyPlayer
        ?? (mod as unknown as { default?: TwistyPlayerCtor }).default;
      if (C) setCtor(() => C);
    }).catch((err) => console.warn('cubing/twisty load failed', err));
    return () => { cancelled = true; };
  }, [Ctor, plan?.cubingPuzzle]);

  // Build the TwistyPlayer once per puzzle change.
  useEffect(() => {
    if (!plan?.cubingPuzzle || !Ctor || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;
    try {
      player = new Ctor({
        puzzle: plan.cubingPuzzle,
        experimentalSetupAlg: scramble || '',
        visualization,
        background: 'none',
        controlPanel: 'none',
        hintFacelets: 'none',
      });
      playerRef.current = player;
      // NOTE: 不要设 display:block — cubing :host 用 display:grid 让 .wrapper
      // 作为 grid item 撑满 host;block 会让 .wrapper (contain:size + 无显式 h)
      // 塌成 0 高,SVG 渲染了但不可见。
      player.style.width = '100%';
      player.style.height = '100%';
      host.appendChild(player);
    } catch (err) {
      console.warn(`[CubingPreview] TwistyPlayer init failed for ${plan.cubingPuzzle}`, err);
    }
    return () => {
      playerRef.current = null;
      if (player && player.parentNode) player.parentNode.removeChild(player);
    };
    // We intentionally don't depend on `scramble` here — that's handled below
    // by mutating experimentalSetupAlg without rebuilding the WebGL ctx.
    // visualization is in deps because '2D'⇄'3D' requires a fresh TwistyPlayer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Ctor, plan?.cubingPuzzle, visualization]);

  // Live-update the scramble without rebuilding the player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try { player.experimentalSetupAlg = scramble || ''; } catch { /* ignore */ }
  }, [scramble]);

  if (!plan) {
    return <div className={className} style={{ display: 'none' }} aria-hidden />;
  }

  // Fixed-height mode keeps every puzzle the same height; width follows the
  // puzzle's natural w:h ratio via CSS aspect-ratio (so a string height like
  // 'min(28vw,26dvh,260px)' stays fluid). Otherwise size drives both dims.
  const boxStyle: CSSProperties = height != null
    ? { height: typeof height === 'number' ? `${height}px` : height, aspectRatio: `${plan.w} / ${plan.h}`, display: 'block' }
    : { width: plan.w * size, height: plan.h * size, display: 'block' };

  if (portedSvg) {
    return (
      <div
        className={className}
        style={boxStyle}
        role="img"
        aria-label={`${event} scramble preview`}
        dangerouslySetInnerHTML={{ __html: portedSvg }}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={boxStyle}
      role="img"
      aria-label={`${event} scramble preview`}
    />
  );
}
