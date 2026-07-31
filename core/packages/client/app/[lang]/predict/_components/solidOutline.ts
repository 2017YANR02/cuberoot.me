/**
 * 逐张 mesh 拼图(金字塔 / 斜转 / 枫叶)的「高亮框」—— NxN 那档 FM_OUTLINE 的等价实现。
 *
 * NxN 走 shader(`engine/nxn/stickerOutline.ts`):贴纸不换色,沿圆角矩形 SDF 的内圈描一
 * 圈高亮色。这几个拼图的贴纸是逐张 `ExtrudeGeometry`,形状各不相同(三角 / 菱形 / 透镜 /
 * 花瓣),没有一份能共用的 SDF,于是换个等价做法:
 *   **整张贴纸刷成描边色,再盖一张按面内缩小的同形副本,副本上真实颜色。**
 * 露出来的那一圈就是框,宽度 = `BAND_RATIO` × 质心到该方向轮廓的距离 —— 与 NxN 那圈
 * 同一个语义:框长在贴纸**内部**,不外扩。(外扩试过:拼图轮廓边缘会支出一片飞边,
 * 金字塔的斜面尤其明显。)
 *
 * 两条约定:
 *   · 副本是贴纸自己的 child,转层时跟着块跑,不必另同步(同 `engine/hintFacelets.ts`)。
 *   · 只在**贴纸平面内**缩,法向不动 —— 副本与本体严格共面,斜视角下不会错位成宽窄
 *     不匀的框;共面带来的 z-fight 交给 polygonOffset 判胜负,不靠把副本浮起来。
 */
import * as THREE from 'three';

/** 框的颜色单一源仍在 NxN 那份(引擎的高亮品红);从这里转出去,免得 `PredictBoard`
 *  为一个色值静态 import 那个模块 —— 它带 three,会被拖进首包。 */
export { OUTLINE_DEFAULT } from '@/app/[lang]/sim/engine/nxn/stickerOutline';

/** 框宽 ÷ 质心到轮廓的距离。NxN 那圈是 OUTLINE_WIDTH 4.5 ÷ 贴纸半宽 28,照抄同一个
 *  比例,两条渲染路径的框看上去一样粗。 */
const BAND_RATIO = 0.16;

/** 描边色由调用方给(单一源是 `engine/nxn/stickerOutline.ts` 的 OUTLINE_DEFAULT)。 */
export interface StickerFrame {
  /** 中心那张真实颜色的副本;`visible` 即这枚贴纸要不要框。 */
  patch: THREE.Mesh;
  /** 副本的材质 —— 框亮着时往它写贴纸的真实颜色。 */
  material: THREE.Material & { color: THREE.Color };
}

/**
 * 给一张贴纸挂上高亮框。`material` 必须是这张贴纸自己那份材质的克隆(同型号才能和
 * 未加框的贴纸看上去一模一样),挂上后由本模块接管其 polygonOffset;调用方负责 dispose。
 * 贴纸缺 `simStickerNormal`(不是 makeSticker 建的)时返回 null,调用方退回不加框。
 */
export function attachStickerFrame(
  mesh: THREE.Mesh,
  material: THREE.Material & { color: THREE.Color },
): StickerFrame | null {
  const n = (mesh.userData.simStickerNormal as THREE.Vector3 | undefined)?.clone().normalize();
  const pos = mesh.geometry.getAttribute('position');
  if (!n || !pos || pos.count === 0) return null;

  // 质心:贴纸是薄板挤出体,顶底两片轮廓点数相同,取全体顶点均值即面内质心。
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) c.add(p.fromBufferAttribute(pos, i));
  c.multiplyScalar(1 / pos.count);

  // 面内缩 k、法向缩 1 的仿射:S = k·I + (1−k)·n nᵀ,再绕质心(而非原点)作用。
  const k = 1 - BAND_RATIO;
  const m = 1 - k;
  const s = new THREE.Matrix4().set(
    k + m * n.x * n.x, m * n.x * n.y, m * n.x * n.z, 0,
    m * n.y * n.x, k + m * n.y * n.y, m * n.y * n.z, 0,
    m * n.z * n.x, m * n.z * n.y, k + m * n.z * n.z, 0,
    0, 0, 0, 1,
  );
  s.setPosition(c.clone().sub(c.clone().applyMatrix4(s)));

  // 与本体共面 → 深度值打平,靠 polygonOffset 把副本拉到前面(贴花的标准做法)。
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;

  // 几何是贴纸自己那份(只读共用,不克隆也不 dispose);侧壁那组顶点整个埋在本体
  // 实心板里,画不出来,所以单材质一把画完就行,不必拆 group。
  const patch = new THREE.Mesh(mesh.geometry, material);
  patch.matrixAutoUpdate = false;
  patch.matrix.copy(s);
  patch.visible = false;
  patch.raycast = () => {}; // 点击命中只认本体(题板的 raycast 也只喂贴纸那一层)
  mesh.add(patch);
  return { patch, material };
}
