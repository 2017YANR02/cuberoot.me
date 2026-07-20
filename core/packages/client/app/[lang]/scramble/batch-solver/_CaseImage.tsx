'use client';

/**
 * 批量求解器的 case 图:NxN 走 VisualCube(iso / plan 顶视),Pyraminx 走
 * sr-puzzlegen。上游用 twistysim 渲染,这里换成站内渲染器;Skewb / Megaminx
 * 记号映射未标定,暂不出图(选「无图像」语义)。
 */
import { VisualCube } from '@/components/VisualCube';
import { PuzzleSVG } from '@/components/PuzzleSVG';

export type BatchImageKind = 'none' | '3x3x3-top' | '3x3x3' | '2x2x2-top' | '2x2x2' | '4x4x4' | '5x5x5' | 'pyraminx';

export const BATCH_IMAGE_KINDS: BatchImageKind[] = ['none', '3x3x3-top', '3x3x3', '2x2x2-top', '2x2x2', '4x4x4', '5x5x5', 'pyraminx'];

/** 选择内置谜题时自动带出的图像类型 */
export const IMAGE_KIND_FOR_PUZZLE: Record<string, BatchImageKind> = {
  '3x3x3': '3x3x3-top',
  '2x2x2': '2x2x2-top',
  '4x4x4': '4x4x4',
  Pyraminx: 'pyraminx',
};

// 上游 cubeImage 的 4x4 内层记号替换表(2R → r R' 等),visualcube 同样不认 2R
const SLICE_REPLACEMENTS: [string, string][] = [
  ["2R'", "r' R"], ['2R2', 'r2 R2'], ['2R', "r R'"],
  ["2L'", "l' L"], ['2L2', 'l2 L2'], ['2L', "l L'"],
  ["2U'", "u' U"], ['2U2', 'u2 U2'], ['2U', "u U'"],
  ["2D'", "d' D"], ['2D2', 'd2 D2'], ['2D', "d D'"],
  ["2F'", "f' F"], ['2F2', 'f2 F2'], ['2F', "f F'"],
  ["2B'", "b' B"], ['2B2', 'b2 B2'], ['2B', "b B'"],
];

export function convert4x4Setup(setup: string): string {
  for (const [from, to] of SLICE_REPLACEMENTS) {
    setup = setup.replaceAll(from, to);
  }
  return setup;
}

export default function CaseImage({ kind, setup, size, title }: { kind: BatchImageKind; setup: string; size: number; title?: string }) {
  if (kind === 'none') return null;
  if (kind === 'pyraminx') {
    return (
      <span title={title} className="bsv-case-img">
        <PuzzleSVG kind="pyraminx" alg={setup} size={size} />
      </span>
    );
  }
  const pzl = kind.startsWith('2x2x2') ? 2 : kind === '4x4x4' ? 4 : kind === '5x5x5' ? 5 : 3;
  const view = kind.endsWith('-top') ? 'plan' : 'iso';
  return (
    <span title={title} className="bsv-case-img">
      <VisualCube setup={kind === '4x4x4' ? convert4x4Setup(setup) : setup} view={view} size={size} puzzleSize={pzl} alt={title ?? 'case'} />
    </span>
  );
}
