// 自定义阶段:用户自己点贴纸/整块决定哪些保留颜色,其余置灰。
//
// 与预设阶段(stickering.ts 的 OLL/PLL/Cross…)唯一的区别是「规则从哪来」——
// 预设用坐标谓词算,自定义直接存一份贴纸清单。语义完全相同:清单写在**还原帧**
// 的 home sid 上,渲染层按 slot 上色 → 颜色随块走,打乱后仍标注同一批块。
//
// id 空间不自造:用 mask-core 的 canonical sticker id(`${面字母}${展开图 index}`,
// 面序 U R F D L B),与伴图遮罩 / 箭头 DSL / visualcube 同一套,所以清单的存取
// 直接复用 parseMask / formatMask(`U:0,2;F:3-5`),URL 里也是人读的。
//
// 通用性:对外三个动作 —— 「点中的东西 → sid」「sid 清单 → 遮罩函数」「切换选中」。
// 只有第一个是 NxN 专属(要把世界面转回块的本地面);换别的拼图时照 pyra/skewb/mega
// 已有的 userData.stickerKey 出一份同签名的 pickedSid 即可,后两个原样复用。
import { FACE } from '../define';
import { engineHomeSid } from './netIndex';
import { parseMask, formatMask, type StickerId } from '@/lib/puzzle-image/mask-core';
import { FM_REGULAR, FM_DIM, FM_IGNORED, FM_OUTLINE, type FaceletMask, type StickeringMaskFn } from './stickering';
import type Cube from './cube';

/** 阶段下拉里代表「自定义」的值(URL `?stickering=custom`)。 */
export const CUSTOM_STICKERING = 'custom';

/** 选取粒度:一次点中一枚贴纸,还是它所在的整块。 */
export type PickGrain = 'sticker' | 'piece';

/**
 * 一枚贴纸的画法。预设阶段本来就在混用前三档(如 CLL = 顶层原色 + 前两层压暗),
 * 自定义把「选中的」和「其余的」各挑一档交给用户,于是同样画得出预设那种层次。
 * `outline` 是站内加的第四档:**不换色**,沿边缘描一圈高亮 —— 要指认「就是这一枚」
 * 而又不能把它的颜色盖掉时用(见 engine/nxn/stickerOutline.ts)。
 * (FM_ORIENTED/2 是 twizzle 表示「只看朝向」的记号色,与点选语义无关,不开放。)
 */
export const CUSTOM_TREATMENTS = ['regular', 'dim', 'ignored', 'outline'] as const;
export type CustomTreatment = (typeof CUSTOM_TREATMENTS)[number];

const TREATMENT_CODE: Record<CustomTreatment, FaceletMask> = {
  regular: FM_REGULAR,
  dim: FM_DIM,
  ignored: FM_IGNORED,
  outline: FM_OUTLINE,
};

/** cubelet 的 home 网格坐标(initial 索引的编码,见 netIndex.ts)。 */
function homeCoords(cubeletInitial: number, N: number): [number, number, number] {
  const N2 = N * N;
  return [cubeletInitial % N, ((cubeletInitial % N2) / N) | 0, (cubeletInitial / N2) | 0];
}

/** 某块在还原态露在外面的那几个面(内部面没有贴纸)。 */
function outerFaces(cubeletInitial: number, N: number): FACE[] {
  const [x, y, z] = homeCoords(cubeletInitial, N);
  const max = N - 1;
  const out: FACE[] = [];
  if (y === max) out.push(FACE.U);
  if (y === 0) out.push(FACE.D);
  if (z === max) out.push(FACE.F);
  if (z === 0) out.push(FACE.B);
  if (x === max) out.push(FACE.R);
  if (x === 0) out.push(FACE.L);
  return out;
}

/** 某块的全部贴纸 sid(还原帧);中心块 1 枚、棱 2 枚、角 3 枚。 */
export function pieceSids(cubeletInitial: number, N: number): StickerId[] {
  return outerFaces(cubeletInitial, N).map((f) => engineHomeSid(cubeletInitial, f, N));
}

/**
 * 点击命中 → 该贴纸的 home sid(选不中则 null)。
 *
 * controller 给的是**当前格位** + **世界面**(它按射线打在哪个外平面、落在哪一格
 * 算出来的),打乱后既不是本位也不是块的本地面:先用 cubelets 找到此刻占着这个格
 * 的块,再让块拿自己的四元数把世界面转回本地面,最后才落到还原帧的 sid。
 * 少任何一步,拧过的魔方上点出来的都是另一枚贴纸。
 */
export function pickedSids(cube: Cube, positionIndex: number, worldFace: number, grain: PickGrain): StickerId[] {
  const cubelet = cube.cubelets.get(positionIndex);
  if (!cubelet) return [];
  if (grain === 'piece') return pieceSids(cubelet.initial, cube.order);
  const localFace = cubelet.getFace(worldFace as FACE);
  // 内部面没贴纸(理论上射线只会打到外面,保险起见挡一道)。
  if (!cubelet.colors[localFace]) return [];
  return [engineHomeSid(cubelet.initial, localFace, cube.order)];
}

/**
 * 贴纸清单 → 阶段遮罩函数。选中的按 pick 画、其余按 rest 画(默认 = 保原色 + 置灰,
 * 同 Cross/F2L 等阶段对无关块的处理;rest 换成 dim 即 CLL 那类预设的层次)。
 * 空清单返回 null = 不遮罩,好让用户看着真配色去点第一枚。
 */
export function customMaskFn(
  order: number,
  mask: string,
  pick: CustomTreatment = 'regular',
  rest: CustomTreatment = 'ignored',
): StickeringMaskFn | null {
  const ids = parseMask(mask);
  if (ids.size === 0) return null;
  const on = TREATMENT_CODE[pick] ?? FM_REGULAR;
  const off = TREATMENT_CODE[rest] ?? FM_IGNORED;
  return (initial, face) => (ids.has(engineHomeSid(initial, face, order)) ? on : off);
}

/** 切换一组 sid:整组已全选则整组取消,否则整组选上(整块粒度下才有「半选」)。 */
export function toggleSids(mask: string, sids: readonly StickerId[]): string {
  if (sids.length === 0) return mask;
  const ids = parseMask(mask);
  const allOn = sids.every((s) => ids.has(s));
  for (const s of sids) {
    if (allOn) ids.delete(s);
    else ids.add(s);
  }
  return formatMask(ids);
}

/** 已选贴纸数(UI 显示用)。 */
export function countSids(mask: string): number {
  return parseMask(mask).size;
}
