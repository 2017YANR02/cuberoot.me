/**
 * 一个 case 的**规范深链** —— 全站只此一份。
 *
 * 落点是 `#case-<id>` 锚点(AlgCategoryView 接住它:滚过去 + 闪一下)。锚点不是页内状态,
 * 是 URL 片段,和「URL 状态一律走 nuqs」那条不冲突。
 *
 * 子组段**只在 case 真有子组时才加**:umbrella set(zbll / 1lll / ollcp …)不带子组会落到
 * 子组选择页,卡片根本不渲染;而没有子组的 case 硬塞一个 `_` 占位段,会让
 * `slugLevel` 判成 null 把所有 case 过滤光 —— 页面全空。
 */
import { type AlgCase } from '@cuberoot/shared';

type CaseRef = Pick<AlgCase, 'id' | 'subgroup'>;

export function algCaseHref(puzzle: string, set: string, c: CaseRef): string {
  const top = (c.subgroup || '').split('/', 1)[0];
  const base = `/alg/${puzzle}/${set}`;
  const path = top ? `${base}/${encodeURIComponent(top.toLowerCase())}` : base;
  return c.id != null ? `${path}#case-${c.id}` : path;
}
