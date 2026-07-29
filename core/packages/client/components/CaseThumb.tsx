'use client';

/**
 * CaseThumb — single source for any (puzzle, set, case) preview thumbnail.
 * Ported from packages/client-vite/src/pages/alg/CaseThumb.tsx.
 */
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { toWca as toWcaSkewb } from '@cuberoot/shared/skewb-notation';
import { VisualCube } from '@/components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '@/components/PuzzleSVG';
import { EnginePuzzleSVG } from '@/components/EnginePuzzleSVG';
import { apiUrl } from '@/lib/api-base';

export const PUZZLE_SIZE: Record<AlgPuzzle, number> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
  'sq1': 3, 'megaminx': 3, 'pyraminx': 3, 'skewb': 3,
};

export const SR_PUZZLES: AlgPuzzle[] = ['sq1', 'megaminx', 'pyraminx', 'skewb'];

export function srPuzzleKind(p: AlgPuzzle): PuzzleKind | null {
  if (p === 'sq1')      return 'sq1-net';
  if (p === 'megaminx') return 'megaminx-top';
  if (p === 'pyraminx') return 'pyraminx';
  if (p === 'skewb')    return 'skewb-top';
  return null;
}

export function pickView(puzzle: AlgPuzzle, set: string, sticker: AlgSticker): 'f2l' | 'oll' | 'pll' | 'pll-iso' {
  if (puzzle === '3x3' && sticker.kind === 'f2l') return 'f2l';
  if (set === 'oll' || set === 'oll-parity') return 'oll';
  return 'pll';
}

const CORNER_LL_MASK: Partial<Record<string, string>> = {
  coll: 'coll',
  cmll: 'cmll',
};

export function CaseThumb({
  puzzle, set, sticker, alg, setup, size = 88, mask: maskOverride, local, loading,
}: {
  puzzle: AlgPuzzle;
  set: string;
  sticker: AlgSticker;
  alg: string;
  setup?: string;
  size?: number;
  mask?: string;
  /** NxN 走本地渲染(瞬时、与同屏其它图同帧出现)。见 `VisualCube` 的 `local`。 */
  local?: boolean;
  /**
   * `<img>` 路径的原生加载提示。首屏之外的长网格传 'lazy' —— 视口外的图根本不发请求。
   * 首屏可见的图别传(懒加载会推迟它)。`local` 渲染时无意义(没有请求可省)。
   */
  loading?: 'lazy' | 'eager';
}) {
  if (puzzle === 'sq1') {
    const params = new URLSearchParams({ pzl: 'sq1', variant: 'net' });
    if (setup && setup.trim()) params.set('setup', setup);
    else if (alg) params.set('case', alg);
    return (
      <img
        src={apiUrl(`/v1/visualcube.svg?${params}`)}
        alt="Square-1 case"
        loading={loading}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  if (SR_PUZZLES.includes(puzzle)) {
    const xform = puzzle === 'skewb' ? (s: string) => toWcaSkewb(s, 'sarah') : (s: string) => s;
    const driver = setup && setup.trim() ? { alg: xform(setup) } : { case: xform(alg) };
    // pyraminx iso → /sim 引擎静态渲染(原 sr,PLAN-sr-retirement §3);
    // megaminx-top / skewb-top 是俯视示意形态,保持原渲染器。
    if (puzzle === 'pyraminx') {
      return <EnginePuzzleSVG kind="pyraminx" {...driver} size={size} />;
    }
    const kind = srPuzzleKind(puzzle)!;
    return <PuzzleSVG kind={kind} {...driver} size={size} />;
  }
  if (maskOverride) {
    return <VisualCube algorithm={alg} setup={setup} view="pll" mask={maskOverride} size={size} local={local} loading={loading} />;
  }
  // 最后一槽 + 顶层:等距视角。两个集观察域相同,但遮罩不能共用 ——
  //  zbls 只到「末槽 + 翻棱」,顶层角块不看,vh 遮罩(压灰十字、另三槽、顶层角与四周顶排)正合适;
  //  lsll 整层一步解完,顶层角块与四周顶排恰恰是要认的信息,压灰等于把题遮了。全彩不加遮罩,
  //  与 /alg/lsll 库里那批本地渲染的图(lsll/model.caseFacelets)一致。
  if (puzzle === '3x3' && set === 'lsll') {
    return <VisualCube algorithm={alg} setup={setup} view="iso" size={size} local={local} loading={loading} />;
  }
  if (puzzle === '3x3' && set === 'zbls') {
    return <VisualCube algorithm={alg} setup={setup} view="iso" mask="vh" size={size} local={local} loading={loading} />;
  }
  const cornerMask = puzzle === '3x3' ? CORNER_LL_MASK[set] : undefined;
  if (cornerMask) {
    return <VisualCube algorithm={alg} setup={setup} view="pll" mask={cornerMask} size={size} local={local} loading={loading} />;
  }
  const view = pickView(puzzle, set, sticker);
  return (
    <VisualCube
      algorithm={alg}
      setup={setup}
      view={view}
      // OLL 图侧面那一圈灰格是「这里不是黄」的占位,信息全在黄条上 —— 删掉灰格就是通行的
      // OLL 识别图。顶面 9 格一格不动(侧环由渲染器另一个 pass 画)。pll 不加:那圈是真配色;
      // coll / cmll 更不能加(上面已单独 return),那里的灰恰恰是「这条棱不用看」的题面。
      hideGreySides={view === 'oll'}
      size={size}
      puzzleSize={PUZZLE_SIZE[puzzle]}
      local={local}
      loading={loading}
    />
  );
}
