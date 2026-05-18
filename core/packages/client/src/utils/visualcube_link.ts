/**
 * 给 /scramble/gen 等页面的预览缩略图生成"点开 = 在新窗口看大图"的 api 链接,
 * 指向同一份 server-rendered SVG (/v1/visualcube.svg)。事件 id 与 /visualcube 编辑器
 * 写出的 URL 保持一致(pzl + view=wca)。
 */
import { apiUrl } from './api_base';
import { eventToCubeSize } from '../pages/gen/cube_unfolded_svg';

/** Map WCA event id (incl. synthetic nxnN) → /v1/visualcube.svg pzl keyword.
 *  Returns null for events the server doesn't render (clock 目前无 server 渲染)。 */
function eventToPzl(event: string): string | null {
  if (event === 'sq1') return 'sq1';
  if (event === 'minx') return 'mega';
  if (event === 'pyram') return 'pyra';
  if (event === 'skewb') return 'skewb';
  const n = eventToCubeSize(event);
  if (n) return String(n);
  return null;
}

export function visualcubeApiHref(event: string, scramble: string): string | null {
  const pzl = eventToPzl(event);
  if (!pzl) return null;
  const p = new URLSearchParams();
  p.set('pzl', pzl);
  p.set('view', 'wca');
  if (scramble) p.set('alg', scramble);
  return apiUrl(`/v1/visualcube.svg?${p.toString()}`);
}
