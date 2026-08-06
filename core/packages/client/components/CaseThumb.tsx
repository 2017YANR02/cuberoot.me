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
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from '@/lib/sq1-svg';
import { invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import { sq1StageHiddenStickerIds } from '@/lib/sq1-stage-mask';

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

/** 只看角块的遮罩(集自带的 + {@link LEVEL2_PICKER_MASK})—— 侧环删灰。 */
const CORNER_LL_MASK_NAMES = new Set(Object.values(CORNER_LL_MASK));

/**
 * umbrella 二级选择卡的缩略图遮罩:只显示与该阶段相关的贴纸(角块 LL)。
 * 公式库列表(`AlgCategoryView`)和训练器选择面板(`_trainer/trainer-components`)
 * 是同一批卡片,遮罩表放这里,两边都从 `<CaseThumb mask=…>` 走,不各留一份。
 */
export const LEVEL2_PICKER_MASK: Record<string, string> = {
  zbll: 'coll', '1lll': 'coll', ollcp: 'coll',
};

/**
 * NxN 分支最终喂给 visualcube 的那几个参数(视角 / 遮罩 / 是否删灰格 / 阶数)。
 *
 * 抽成纯函数是因为**同一张图要出两次**:屏幕上走 `<VisualCube>`,PDF 导出走
 * `renderFromSimpleQuery` 拿字符串(lib/alg_pdf/case_svg.ts)。参数留在 JSX 里的话,
 * 两条路迟早各走各的 —— 改了这里的遮罩,PDF 里的图还是老样子。
 */
export function cubeThumbParams(
  puzzle: AlgPuzzle, set: string, sticker: AlgSticker, maskOverride?: string,
): { view: 'iso' | 'plan' | 'oll' | 'pll' | 'f2l' | 'pll-iso'; mask?: string; hideGreySides?: boolean; puzzleSize: number } {
  const puzzleSize = PUZZLE_SIZE[puzzle];
  // 二阶没有中心与隐藏的中间层；每一块贴纸都是 case 本身的一部分。
  // LL/PLL 遮罩会把底层涂灰，LS/TCLL 等未完成层 case 因而看起来像缺块。
  // 二阶缩略图保留平面图，但不接受选择器传来的识别遮罩覆盖。
  if (puzzle === '2x2') return { view: 'plan', puzzleSize };
  if (maskOverride) {
    const hideGreySides = CORNER_LL_MASK_NAMES.has(maskOverride) || undefined;
    return { view: 'pll', mask: maskOverride, hideGreySides, puzzleSize };
  }
  // 最后一槽 + 顶层:等距视角。两个集观察域相同,但遮罩不能共用 ——
  //  zbls 只到「末槽 + 翻棱」,顶层角块不看,vh 遮罩(压灰十字、另三槽、顶层角与四周顶排)正合适;
  //  lsll 整层一步解完,顶层角块与四周顶排恰恰是要认的信息,压灰等于把题遮了。全彩不加遮罩,
  //  与 /alg/lsll 库里那批本地渲染的图(lsll/model.caseFacelets)一致。
  if (puzzle === '3x3' && set === 'lsll') return { view: 'iso', puzzleSize };
  if (puzzle === '3x3' && set === 'zbls') return { view: 'iso', mask: 'vh', puzzleSize };
  // 顶层公式集(coll / cmll)侧环那一圈灰格是「这条棱不用看」的占位,和 OLL 的灰同一
  // 性质 —— 一并删掉,四个侧面只剩真正要认的角块色块。顶面不动(cmll 顶面的灰棱是
  // 「M 层没解开」的题面,侧环由渲染器另一个 pass 画,hideGrey 只管侧环)。
  const cornerMask = puzzle === '3x3' ? CORNER_LL_MASK[set] : undefined;
  if (cornerMask) return { view: 'pll', mask: cornerMask, hideGreySides: true, puzzleSize };
  const view = pickView(puzzle, set, sticker);
  // OLL 图侧面那一圈灰格是「这里不是黄」的占位,信息全在黄条上 —— 删掉灰格就是通行的
  // OLL 识别图。顶面 9 格一格不动。pll 不加:那圈是真配色,没有灰可删。
  return { view, hideGreySides: view === 'oll', puzzleSize };
}

export function CaseThumb({
  puzzle, set, sticker, alg, setup, size = 88, mask: maskOverride, local, loading,
  sq1BlackTop = true,
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
  /** Square-1 flat thumbnails default to the common black-top colour scheme. */
  sq1BlackTop?: boolean;
}) {
  if (puzzle === 'sq1') {
    const forward = setup && setup.trim() ? setup : invertSq1Alg(alg);
    const hidden = sq1StageHiddenStickerIds(set);
    const normalizedSet = set.toLowerCase();
    const renderOptions = {
      ...(hidden ? { mask: { ids: hidden, color: 'transparent' } } : {}),
      compactFaces: normalizedSet !== 'cs',
    };
    const showMiddle = !['cs', 'parity'].includes(normalizedSet) && !hidden;
    const colors = normalizedSet === 'cs'
      ? Object.fromEntries(
          Object.keys(DEFAULT_SQ1_COLORS).map(face => [face, 'var(--muted-foreground)']),
        )
      : sq1BlackTop
        ? { ...DEFAULT_SQ1_COLORS, U: '#000000' }
        : DEFAULT_SQ1_COLORS;
    let svg: string;
    try {
      svg = renderSq1ScrambleSvg(forward, colors, renderOptions, showMiddle);
    } catch {
      // Keep a malformed DB case from breaking the whole catalog grid.
      svg = renderSq1ScrambleSvg('', colors, renderOptions, showMiddle);
    }
    return (
      <div
        className="puzzle-art"
        role="img"
        aria-label="Square-1 case"
        style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: svg }}
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
  const p = cubeThumbParams(puzzle, set, sticker, maskOverride);
  return (
    <VisualCube
      algorithm={alg}
      setup={setup}
      view={p.view}
      mask={p.mask}
      hideGreySides={p.hideGreySides}
      size={size}
      puzzleSize={p.puzzleSize}
      local={local}
      loading={loading}
    />
  );
}
