/**
 * 指向**某一张 case 卡**的链接 —— 分享、元数据弹窗的「在列表中打开」、个人页的校验汇总,
 * 都从这里拿 href,别再各写各的。
 *
 * ## 片段用 case 名,不用 id
 *
 * `#Sune` 比 `#case-122` 有意义:发给别人,对方不点开就知道是哪个 case。名字取 `c.name` ——
 * **就是编辑弹窗里「Case 名」那个字段** —— 所以改完名字 URL 跟着变,不会指向一个已经不
 * 存在的名字。老的 `#case-<id>` 还认(书签、之前发出去的链接),只是不再生成。
 *
 * ## 子组段只在 case 真有子组时才加
 *
 * umbrella set(zbll / 1lll / ollcp …)不带子组会落到子组选择页,卡片根本不渲染;而没有
 * 子组的 case 硬塞一个 `_` 占位段(`|| '_'` 的锅),会让 `slugLevel` 判成 null 把所有 case
 * 过滤光 —— 页面全空。
 */
import { type AlgCase } from '@cuberoot/shared';
import { primaryCaseName } from '@/lib/alg_case_display';

type CaseRef = { id?: number | null; name?: string; subgroup?: string };

/** case 名 → URL 片段。空格换 `-`(`#EG1-S-1` 比 `#EG1%20S%201` 好读),其余照常转义。 */
export function caseAnchor(name: string): string {
  return encodeURIComponent(name.trim().replace(/\s+/g, '-'));
}

/** 片段 / case 名 → 可比较的键:大小写、空格、`-` 一律不敏感(手打的链接也能落地) */
function anchorKey(s: string): string {
  let t = s;
  try { t = decodeURIComponent(s); } catch { /* 半截转义序列:原样比 */ }
  return t.trim().toLowerCase().replace(/[\s-]+/g, '-');
}

export function algCaseHref(puzzle: string, set: string, c: CaseRef): string {
  const top = (c.subgroup || '').split('/', 1)[0];
  const base = `/alg/${puzzle}/${set}`;
  const path = top ? `${base}/${encodeURIComponent(top.toLowerCase())}` : base;
  if (c.name?.trim()) return `${path}#${caseAnchor(c.name)}`;
  return c.id != null ? `${path}#case-${c.id}` : path;
}

/**
 * 落地时把 `#…` 认回是哪张 case。三种都收:
 *   1. `#Sune` —— 现在生成的
 *   2. `#S+-(27)` —— **卡面上**那个名字。oll / pll / 1lll 的主名是派生的(`c.name` 是
 *      `OLL 27`,卡面写 `S+ (27)`),有人照着卡面手打链接,认了不亏
 *   3. `#case-122` —— 老链接
 */
export function findCaseByHash(
  cases: AlgCase[],
  hash: string,
  puzzle: string,
  set: string,
): AlgCase | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const legacy = /^case-(\d+)$/.exec(raw);
  if (legacy) {
    const id = Number(legacy[1]);
    return cases.find(c => c.id === id) ?? null;
  }

  const key = anchorKey(raw);
  return cases.find(c => anchorKey(c.name) === key)
    ?? cases.find(c => anchorKey(primaryCaseName(puzzle, set, c)) === key)
    ?? null;
}
