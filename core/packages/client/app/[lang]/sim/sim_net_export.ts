// 引擎驱动的 NxN 展开图(net / wca)导出器 —— 退役对照表 §2b「视图 net / wca」的落点。
//
// **不再平行自绘**(plan 视图同款教训):SVG 装配直调 tnoodle 参照实现
// cube_unfolded_svg 的共享 emitter(renderUnfoldedStateSvg),布局(GAP 0.2 /
// stroke 0.1 / viewBox 4N+5G × 3N+4G)、属性顺序、字节格式与 studio 的 spec 渲染
// (renderSpecSvg → renderUnfoldedSvg)按构造完全一致,引擎只负责喂色:状态取
// `cube.serialize()`(URFDLB 六个 N² 块,已是 net 朝向)→ 逐格引擎面色。
//
// 交互式 `_SimCubeNet` 仍从这里取布局常量(单一源,与导出件逐格对齐)。

import { GAP, STROKE_W, renderUnfoldedStateSvg } from '@cuberoot/shared/cube-unfolded-svg';

export type NetFaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export const NET_GAP = GAP;           // 面间距(格单位)= tnoodle 2/10
export const NET_STROKE_W = STROKE_W; // 贴纸描边(相对 1×1 格)= tnoodle 1/10

/** serialize() 串里的 URFDLB 块顺序。 */
export const NET_FACE_ORDER: NetFaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** cstimer face id 序(cube_unfolded_svg emitter 的 f=0..5)。 */
const CSTIMER_FACES: NetFaceLetter[] = ['D', 'L', 'B', 'U', 'R', 'F'];

/** 展开十字里每个面的西北角 (col, row)(格单位),与 emitter 的 FACE_OFFSETS 同式。 */
export function netFaceOffsets(N: number): Record<NetFaceLetter, [number, number]> {
  return {
    U: [2 * NET_GAP + N, NET_GAP],
    L: [NET_GAP, 2 * NET_GAP + N],
    F: [2 * NET_GAP + N, 2 * NET_GAP + N],
    R: [3 * NET_GAP + 2 * N, 2 * NET_GAP + N],
    B: [4 * NET_GAP + 3 * N, 2 * NET_GAP + N],
    D: [2 * NET_GAP + N, 3 * NET_GAP + 2 * N],
  };
}

export interface SimNetExportOptions {
  /** cube.serialize():URFDLB 六个 N² 块的面字母串(net 朝向)。 */
  serialized: string;
  order: number;
  /** 面字母 → 色(引擎 settings.faceColors,单一源)。 */
  faceColors: Record<NetFaceLetter, string>;
  /** 遮罩:net index(face 块内 row*N+col,全局 = 块基址 + 局部)∈ set 的格填 maskColor。
   *  key = `${face}:${localIdx}`(localIdx = row*N+col)。 */
  mask?: { keys: ReadonlySet<string>; color: string };
}

/** URFDLB 面字母 → 引擎面色;非法字符落灰。 */
function colorOf(ch: string, faceColors: Record<NetFaceLetter, string>): string {
  return ch === 'U' || ch === 'R' || ch === 'F' || ch === 'D' || ch === 'L' || ch === 'B'
    ? faceColors[ch]
    : '#444';
}

/**
 * NxN 展开图 → 纯字符串 SVG(伴图显示 + SVG/PNG 下载同一份;调用方经 sizeEngineSvg
 * 钉图片尺寸)。字节格式 = renderUnfoldedSvg 参照(共享 emitter)。
 */
export function exportSimNetSvg(opts: SimNetExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const facelets = opts.serialized;
  const maskKeys = opts.mask?.keys;
  const maskColor = opts.mask?.color;

  return renderUnfoldedStateSvg(N, (f, row, col) => {
    const face = CSTIMER_FACES[f];
    const local = row * N + col;
    if (maskKeys?.has(`${face}:${local}`)) return maskColor!;
    const base = NET_FACE_ORDER.indexOf(face) * N * N;
    return colorOf(facelets[base + local] ?? '', opts.faceColors);
  });
}
