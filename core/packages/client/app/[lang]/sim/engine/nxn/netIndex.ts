// NxN 展开图坐标 —— 纯数学,零依赖(尤其**不 import visualcube**),故引擎渲染层
// (instanced.ts)可安全引用而不把 visualcube 包拖进模块图。
//
// 单一源:netIndexOf 从这里出,vcStageMask 再导出保 API(它另叠 makeMasking 桥,
// 会拖 visualcube,所以纯坐标必须独立成文)。netIndexOf 已对真实 visualcube 位串
// 核验(见 vc_stage_mask.test.ts 的 2x2 DFR 块 / XCROSS 侧块朝向)。
import { FACE } from '../define';

/** 引擎某面上的贴纸(cubelet 网格坐标 x,y,z + 该面)→ visualcube 展开图 index
 *  (row*N+col「按展开图所画」)。x,y,z ∈ 0..max(= N-1),face = 引擎 FACE。 */
export function netIndexOf(x: number, y: number, z: number, face: number, max: number, N: number): number {
  switch (face) {
    case FACE.U: return z * N + x;                 // U:row=z(0=B侧) col=x(0=L)
    case FACE.D: return (max - z) * N + x;          // D:row=max-z(0=F侧) col=x
    case FACE.F: return (max - y) * N + x;          // F:row=max-y(0=U) col=x
    case FACE.B: return (max - y) * N + (max - x);  // B:镜像 col=max-x
    case FACE.R: return (max - y) * N + (max - z);  // R:col=max-z(0=F侧)
    case FACE.L: return (max - y) * N + z;          // L:col=z(0=B侧)
    default: return 0;
  }
}

/** 引擎 FACE(L0 R1 D2 U3 B4 F5)→ visualcube Face 编号(U0 R1 F2 D3 L4 B5)。 */
export const ENGINE_TO_VC_FACE: Record<number, number> = {
  [FACE.U]: 0, [FACE.R]: 1, [FACE.F]: 2, [FACE.D]: 3, [FACE.L]: 4, [FACE.B]: 5,
};

/** visualcube Face 编号 → 面字母(canonical sid 的面前缀,mask-core CANONICAL_FACES.cube)。 */
export const VC_FACE_LETTER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/**
 * 引擎某贴纸的 HOME(还原态)canonical sticker id —— `${面字母}${netIndex}`,与
 * mask-core 的 cube id 空间(面 U R F D L B,index=row*N+col 展开图所画)同一套。
 * cubeletInitial 编码 home 网格坐标(cubelet.ts:`x=idx%N, y=⌊idx/N⌋%N, z=⌊idx/N²⌋`)。
 *
 * 用途:NxN InstancedMesh 每个贴纸槽位打上它的 HOME sid,示意导出器据此把 `mask`
 * 里的 sid 灰化对应实例 —— 贴纸实例跟物理块走(piece-following),故键 HOME 位置 =
 * 灰随块走,与 pyra/skewb/mega(stickerKey)及 sr(applyMask 在 applyAlgorithm 前)
 * 同语义(mask-core 头注)。
 */
export function engineHomeSid(cubeletInitial: number, face: number, N: number): string {
  const N2 = N * N;
  const max = N - 1;
  const x = cubeletInitial % N;
  const y = ((cubeletInitial % N2) / N | 0);
  const z = (cubeletInitial / N2 | 0);
  const netIdx = netIndexOf(x, y, z, face, max, N);
  return VC_FACE_LETTER[ENGINE_TO_VC_FACE[face]] + netIdx;
}
