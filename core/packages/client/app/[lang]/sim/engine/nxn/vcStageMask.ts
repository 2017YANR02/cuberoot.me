// visualcube 阶段遮罩 → 引擎 stickering(退役对照表 §2b:把 /visualcube studio 的
// 整个 MASK 清单搬进 /sim 主魔方 stickering 下拉,去重)。
//
// 桥不需要几何标定:mask-core.ts 明确 NxN 贴纸 id 空间(面 U R F D L B、index =
// row*N+col「按展开图所画」)与 visualcube `ICubeOptions.stickerColors` / makeMasking
// 是同一套。所以 makeMasking(name, N) 的逐面 colored/masked 布尔,经下面标准展开图
// 公式换成引擎 (initial, face) 即可 —— 无需重造轮(直接复用 makeMasking 的谓词 +
// 硬编码位串),也无需像 pyra/skewb/mega 那样几何派生。
//
// 公式(row*N+col;引擎 FACE=L0 R1 D2 U3 B4 F5,x=initial%N y=⌊/N⌋%N z=⌊/N²⌋)已对
// 真实 visualcube 位串核验(2x2x2 的 DFR 块、XCROSS_BR/FL 的侧块朝向)。逐面二值
// (masked→FM_IGNORED 灰 / colored→FM_REGULAR)—— 比引擎自带的逐块规则更细,天然
// 支持 EO_ORBIT 这类逐贴纸遮罩。crossColor 复用引擎同一共轭旋转,阶段随底色重定向。
//
// 分层:本文件是 client-only 增强(engine core stickering.ts 保持 visualcube-free);
// Phase 1 headless 抽包时随 visualcube 消费方一并处理。
import { makeMasking, type FaceValues, type Masking } from '@cuberoot/visualcube';
import { FACE } from '../define';
import {
  FM_REGULAR, FM_IGNORED, crossXform, stickeringGroupsFor,
  type StickeringMaskFn, type StickeringGroup,
} from './stickering';
import {
  CORE_MASKS, EXTENDED_MASKS,
  SIZE2_MASKS, SIZE4_MASKS, SIZE5_MASKS, SIZE6_MASKS, SIZE7_MASKS, SIZE9_MASKS,
  type MaskOption,
} from '@/lib/puzzle-image/masks';

// 引擎 FACE(L0 R1 D2 U3 B4 F5)→ visualcube Face 编号(U0 R1 F2 D3 L4 B5)。
const ENGINE_TO_VC_FACE: Record<number, number> = {
  [FACE.U]: 0, [FACE.R]: 1, [FACE.F]: 2, [FACE.D]: 3, [FACE.L]: 4, [FACE.B]: 5,
};

/** 引擎某面上的贴纸(cubelet x,y,z + 该面)→ visualcube 展开图 index(row*N+col)。 */
export function netIndexOf(x: number, y: number, z: number, face: number, max: number, N: number): number {
  switch (face) {
    case FACE.U: return z * N + x;              // U:row=z(0=B侧) col=x(0=L)
    case FACE.D: return (max - z) * N + x;       // D:row=max-z(0=F侧) col=x
    case FACE.F: return (max - y) * N + x;       // F:row=max-y(0=U) col=x
    case FACE.B: return (max - y) * N + (max - x); // B:镜像 col=max-x
    case FACE.R: return (max - y) * N + (max - z); // R:col=max-z(0=F侧)
    case FACE.L: return (max - y) * N + z;        // L:col=z(0=B侧)
    default: return 0;
  }
}

/** visualcube Masking 名 → 引擎 stickering 遮罩函数(逐小面二值)。该阶数无此遮罩
 *  (makeMasking 抛错)→ null,调用方回退 full。 */
export function visualcubeStageMaskFn(order: number, name: string, crossColor?: string): StickeringMaskFn | null {
  let fv: FaceValues;
  try {
    fv = makeMasking(name as Masking, order);
  } catch {
    return null;
  }
  const max = order - 1;
  const N = order;
  const N2 = order * order;
  const xf = crossXform(crossColor);
  return (initial, face) => {
    const [x, y, z] = xf.map(initial % N, ((initial / N) | 0) % N, (initial / N2) | 0, max);
    const mf = xf.facePerm[face] ?? face;           // 遮罩坐标系下的面
    const idx = netIndexOf(x, y, z, mf, max, N);
    return fv[ENGINE_TO_VC_FACE[mf]]?.[idx] ? FM_REGULAR : FM_IGNORED;
  };
}

/** 引擎自带阶段优先(更丰富:dim 层次 + crossColor);未知名再落到 visualcube 遮罩。 */
export function resolveStageMaskFn(order: number, name: string, crossColor?: string): StickeringMaskFn | null {
  // engine-native 分支在 stickeringMaskFn 里;这里只在它返回 null 且非 full 时兜 vc。
  // 直接调用方(SimPage)已先试 stickeringMaskFn,故本函数只做 vc 分支。
  if (!name || name === 'full') return null;
  return visualcubeStageMaskFn(order, name, crossColor);
}

// ── 下拉清单(把 visualcube MASK 清单并进 stickering,按语义去重)──────────────

/** visualcube 遮罩枚举值 → 引擎已有同义阶段名(名字可能不同,语义相同 → 去重)。 */
const VC_DUP: Record<string, string> = {
  oll: 'OLL', ll: 'LL', cll: 'CLL', coll: 'COLL', ell: 'ELL', ocll: 'OCLL',
  els: 'ELS', cls: 'CLS', cmll: 'CMLL', cross: 'Cross', f2l: 'F2L',
  '2x2x2': '2x2x2', '2x2x3': '2x2x3',
};

/** value → 展示标签(取自 masks.ts,免在 UI 层重列)。跨 size 数组同 value 标签一致。 */
export const VC_MASK_LABEL: Record<string, string> = Object.fromEntries(
  [
    ...CORE_MASKS, ...EXTENDED_MASKS,
    ...SIZE2_MASKS, ...SIZE4_MASKS, ...SIZE5_MASKS, ...SIZE6_MASKS, ...SIZE7_MASKS, ...SIZE9_MASKS,
  ].filter((m) => m.value).map((m) => [m.value, m.label]),
);

/** 某阶数适用的 visualcube 遮罩数组(CORE 的谓词遮罩任意阶通用;EXTENDED 仅 3 阶;
 *  其余按阶取 SIZE_N)。 */
function vcArraysFor(order: number): { core: MaskOption[]; extra: MaskOption[] } {
  const SIZE: Record<number, MaskOption[]> = {
    2: SIZE2_MASKS, 4: SIZE4_MASKS, 5: SIZE5_MASKS, 6: SIZE6_MASKS, 7: SIZE7_MASKS, 9: SIZE9_MASKS,
  };
  if (order === 3) return { core: CORE_MASKS, extra: EXTENDED_MASKS };
  return { core: CORE_MASKS, extra: SIZE[order] ?? [] };
}

/** 把 visualcube MASK 清单折成 stickering 分组,滤掉空项 + 与引擎自带阶段重名者。 */
export function visualcubeStageGroups(order: number): StickeringGroup[] {
  if (order < 2) return [];
  const engineNames = new Set(stickeringGroupsFor(order).flatMap((g) => g.items));
  const keep = (m: MaskOption): boolean =>
    m.value !== '' && !(VC_DUP[m.value] && engineNames.has(VC_DUP[m.value]));
  const items = (arr: MaskOption[]): string[] => arr.filter(keep).map((m) => m.value);
  const { core, extra } = vcArraysFor(order);
  const out: StickeringGroup[] = [];
  const coreItems = items(core);
  if (coreItems.length) out.push({ group: 'VCMasks', items: coreItems });
  const extraItems = items(extra);
  if (extraItems.length) out.push({ group: order === 3 ? 'VCMasksExt' : 'VCMasksSize', items: extraItems });
  return out;
}
