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

/**
 * case → **短 URL 片段**的原始素材:有 mark(`meta.ollcp`)就用它(剥掉冗余的 `SET-` 前缀,
 * 同 {@link primaryCaseName}),否则退回 case 名。ZBLL `UR3`→`ur3`、`S+B1`→`s+b1`、
 * PLL `PLL-A+`→`a+`;非 meta 的 F2L `A+`→`a+`、OLL `OLL 27`→`oll-27`。
 *
 * `+` / `-` **保留**(实测本站 nginx+Vercel 全链路不会把 path 里的 `+` 转成空格),这样
 * 短链和社区记号一致、最好认。空格→`-`,其余非 `[a-z0-9+-]` 也→`-`。
 */
export function slugifyCasePart(s: string): string {
  return s.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9+-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** mark 的原始素材(剥 `SET-` 前缀);非 meta case 用 case 名。 */
function caseSlugSource(set: string, c: AlgCase): string {
  const mark = c.meta?.ollcp;
  if (!mark) return c.name;
  const prefix = `${set.toUpperCase()}-`;
  return mark.startsWith(prefix) ? mark.slice(prefix.length) : mark;
}

/** 一张 case 的**基础** slug(未去重)。见 {@link buildCaseSlugMap} 做全集内唯一化。 */
export function caseSlugBase(set: string, c: AlgCase): string {
  return slugifyCasePart(caseSlugSource(set, c));
}

export interface CaseSlugMap {
  /** DB id → 唯一 slug(生成链接用) */
  byId: Map<number, string>;
  /** slug → case(落地解析用) */
  bySlug: Map<string, AlgCase>;
}

/**
 * 给**整个 set** 建立 case ↔ slug 的双向唯一映射。
 *
 * 绝大多数 set 的基础 slug 已经全集唯一(mark 天生唯一;多数 set 的 case 名也唯一),直接用。
 * 少数 set(zbls:每个子组下都有 `EO`/`Line`/`VP`… 同名 case)基础 slug 撞车 —— 撞的那些
 * 用**顶层子组**限定成 `<子组>-<名>`(`a+-eo`),子组内名唯一 ⟹ 限定后唯一。极端兜底再追加序号。
 *
 * 生成端(列表卡片)和落地端(详情页)都从**同一份 set 数据**(同一 API、同序)算这张表,
 * 所以两边得到完全一致的 slug —— 是个确定性双射,不用把 slug 存进 DB。
 */
export function buildCaseSlugMap(cases: AlgCase[], set: string): CaseSlugMap {
  const bases = cases.map(c => caseSlugBase(set, c));
  const count = new Map<string, number>();
  for (const b of bases) count.set(b, (count.get(b) ?? 0) + 1);

  const byId = new Map<number, string>();
  const bySlug = new Map<string, AlgCase>();
  const used = new Set<string>();

  cases.forEach((c, i) => {
    let slug = bases[i];
    if ((count.get(slug) ?? 0) > 1) {
      const top = slugifyCasePart((c.subgroup || '').split('/', 1)[0] || '');
      slug = top ? `${top}-${bases[i]}` : bases[i];
    }
    if (used.has(slug)) {
      let n = 2;
      let cand = `${slug}-${n}`;
      while (used.has(cand)) cand = `${slug}-${++n}`;
      slug = cand;
    }
    used.add(slug);
    bySlug.set(slug, c);
    if (c.id != null) byId.set(c.id, slug);
  });

  return { byId, bySlug };
}

/**
 * 落地:URL 片段 → case。先查确定性 slug 表(`ur3` / `s+b1` / `a+-eo`),再退回
 * {@link findCaseByHash}(手打的 case 名 / 卡面名 / 老 `case-<id>`),都没有返 null。
 */
export function resolveCaseSlug(
  cases: AlgCase[],
  slug: string,
  puzzle: string,
  set: string,
): AlgCase | null {
  let key = slug;
  try { key = decodeURIComponent(slug); } catch { /* 半截转义:原样 */ }
  key = key.trim().toLowerCase();
  const map = buildCaseSlugMap(cases, set);
  return map.bySlug.get(key) ?? findCaseByHash(cases, slug, puzzle, set) ?? null;
}

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
  // **最深**的那段子组(`U/UR` → `ur`),不是顶层(`u`)。ZBLL/1LLL 的顶层组页面渲染的是
  // 二级**子组选择器**,那张 case 卡根本不在,`#anchor` 高亮会落空;深链到子组页才看得见它。
  const parts = (c.subgroup || '').split('/').filter(Boolean);
  const seg = parts[parts.length - 1] || '';
  const base = `/alg/${puzzle}/${set}`;
  const path = seg ? `${base}/${encodeURIComponent(seg.toLowerCase())}` : base;
  if (c.name?.trim()) return `${path}#${caseAnchor(c.name)}`;
  return c.id != null ? `${path}#case-${c.id}` : path;
}

/**
 * 指向某一张 case 的**独立详情页**,短链形式 `/alg/<puzzle>/<set>/<slug>` ——
 * 和子组页(`/alg/<puzzle>/<set>/<子组>`)同层。`slug` 由 {@link buildCaseSlugMap} 全集唯一化
 * (`ur3` / `s+b1` / `a+-eo`),`[subgroup]` 路由落地时先按子组匹配、匹配不到再当 case 解析,
 * 两者 slug 空间实测不撞(`ur` vs `ur3`)。老的 `/case/<name>` 段已废弃。
 */
export function algCaseDetailHref(puzzle: string, set: string, slug: string): string {
  return `/alg/${puzzle}/${set}/${slug}`;
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
