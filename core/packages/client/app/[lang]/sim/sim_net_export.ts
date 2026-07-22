// 引擎驱动的 NxN 展开图(net)导出器 —— 退役对照表 §2b「视图 net」的落点。
//
// 唯一源:布局常量(GAP / STROKE_W / FACE_ORDER / faceOffsets)与交互式 `_SimCubeNet`
// 共用(它 import 这里),导出件与页内平面图逐格对齐、免两份漂移。状态取 `cube.serialize()`
// (URFDLB 六个 N² 块,已是 net 朝向,见 cube.ts serialize())→ 逐格上引擎面色,产纯
// 字符串 SVG(伴图显示 + SVG/PNG 下载同一份)。
//
// visualcube studio 的 wca(记分表)视图复用同布局(exportSimWcaSvg),只是 tnoodle 风格
// 描边/底色微调。

export type NetFaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export const NET_GAP = 0.18;      // 面间距(格单位)
export const NET_STROKE_W = 0.05; // 贴纸描边(相对 1×1 格)

/** serialize() 串里的 URFDLB 块顺序。 */
export const NET_FACE_ORDER: NetFaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** 展开十字里每个面的西北角 (col, row)(格单位)。 */
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
  /** 背景色;默认 null = 透明。 */
  background?: string | null;
  /** 贴纸描边色;默认黑(= visualcube 网格黑边)。 */
  strokeColor?: string;
  /** 描边宽(相对 1×1 格);默认 NET_STROKE_W。 */
  strokeWidth?: number;
  /** 遮罩:net index(face 块内 row*N+col,全局 = 块基址 + 局部)∈ set 的格填 maskColor。
   *  key = `${face}:${localIdx}`(localIdx = row*N+col),与 exportSimNetSvg 内部一致。 */
  mask?: { keys: ReadonlySet<string>; color: string };
}

const fmt = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

/** URFDLB 面字母 → 引擎面色;非法字符落灰。 */
function colorOf(ch: string, faceColors: Record<NetFaceLetter, string>): string {
  return ch === 'U' || ch === 'R' || ch === 'F' || ch === 'D' || ch === 'L' || ch === 'B'
    ? faceColors[ch]
    : '#444';
}

/**
 * NxN 展开图 → 纯字符串 SVG。viewBox `0 0 (4N+5GAP) (3N+4GAP)`(= _SimCubeNet),width/height
 * 用 viewBox 尺寸(调用方经 sizeEngineSvg 钉图片尺寸)。
 */
export function exportSimNetSvg(opts: SimNetExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const facelets = opts.serialized;
  const offs = netFaceOffsets(N);
  const w = 4 * N + 5 * NET_GAP;
  const h = 3 * N + 4 * NET_GAP;
  const stroke = opts.strokeColor ?? '#000';
  const sw = opts.strokeWidth ?? NET_STROKE_W;
  const maskKeys = opts.mask?.keys;
  const maskColor = opts.mask?.color;

  let cells = '';
  for (let fi = 0; fi < 6; fi++) {
    const face = NET_FACE_ORDER[fi];
    const [ox, oy] = offs[face];
    const base = fi * N * N;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const local = r * N + c;
        const ch = facelets[base + local] ?? '';
        const masked = maskKeys?.has(`${face}:${local}`);
        const fill = masked ? maskColor! : colorOf(ch, opts.faceColors);
        cells += `<rect x="${fmt(ox + c)}" y="${fmt(oy + r)}" width="1" height="1"`
          + ` fill="${fill}" stroke="${stroke}" stroke-width="${fmt(sw)}"/>`;
      }
    }
  }

  const bg = opts.background
    ? `<rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}"`
    + ` viewBox="0 0 ${fmt(w)} ${fmt(h)}">${bg}${cells}</svg>`;
}
