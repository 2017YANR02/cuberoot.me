/**
 * logo — 顶面 U 中心 logo 贴图 for the NxN cube。
 *
 * 仅奇数阶有正中心块 → 在 U 面中心块顶面贴一张透明贴图(本站 logo 或用户上传)。
 * 偶数阶 / 非 NxN 无中心 → 不显示(caller 传 null 或 setLogo 内部按奇偶 gate)。
 *
 * 贴图按 src 缓存(同一来源只 load 一次);load 完成回调 onReady() 触发 world 重渲染。
 */
import * as THREE from 'three';

/** 本站 logo 资源(public/icons/CubeRoot.png,∛ + 红蓝 3×3 格,透明底深色符号,贴白色中心块清晰)。 */
export const SITE_LOGO_SRC = '/icons/CubeRoot.png';

const _cache = new Map<string, THREE.Texture>();

/** 取(并缓存)logo 贴图。src = SITE_LOGO_SRC 或上传图的 data URL。
 *  贴图立即返回(图片异步 decode),decode 完调 onReady()(→ world.dirty 重渲染)。 */
export function loadLogoTexture(src: string, onReady: () => void): THREE.Texture {
  const cached = _cache.get(src);
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  const tex = loader.load(src, () => { tex.needsUpdate = true; onReady(); });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _cache.set(src, tex);
  return tex;
}

/** 上传图 → 居中铺到透明方形画布 → PNG data URL(≤maxSize,控制 localStorage 占用,
 *  方形避免贴到方形 plane 时拉伸变形)。 */
export async function fileToLogoDataUrl(file: File, maxSize = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxSize / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const side = Math.max(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/png');
}
