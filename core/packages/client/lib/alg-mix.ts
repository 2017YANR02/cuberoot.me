'use client';

/**
 * 合练(把多套公式集混成一场训练)的共用小工具。
 *
 * 路由形态:`/alg/<puzzle>/mix/{run,select}?sets=pll,zbll` —— `mix` 是固定的哨兵段
 * (SSG 预渲染),成员集合放 query,前端读。这样不用为每种组合生成静态页。
 *
 * 关键约定:合练里的 case 都带 `srcSet`,于是 `caseKey()` 自动带上 set 前缀,
 * 而标记 / 记忆仍按各自 set 落地 —— 合练与单练共用同一份进度。
 */
import { ALG_CATALOG, getAlgSetMeta, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { tr } from '@/i18n/tr';

/** 合练路由的固定段。真实 set slug 里没有它(ALG_CATALOG 已确认)。 */
export const MIX_SLUG = 'mix';

/** 一场合练至少两套 —— 一套就是普通单集训练,不该走这条路由。 */
export const MIX_MIN_SETS = 2;

/**
 * 解析 `?sets=` :去空白 / 去重 / 只留该 puzzle 真实存在的 slug / 排序。
 * 排序让「PLL+ZBLL」与「ZBLL+PLL」是同一场(进度不分家)。
 */
export function parseMixSets(puzzle: AlgPuzzle | null, raw: string | null | undefined): string[] {
  if (!puzzle || !raw) return [];
  const known = new Set((ALG_CATALOG[puzzle] ?? []).map(s => s.slug));
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const slug = part.trim().toLowerCase();
    if (slug && known.has(slug)) seen.add(slug);
  }
  return [...seen].sort();
}

/** 成员 slug → 显示名(照 ALG_CATALOG 的双语名)。 */
export function setLabel(puzzle: AlgPuzzle, slug: string): string {
  const meta = getAlgSetMeta(puzzle, slug);
  return meta ? tr(meta) : slug.toUpperCase();
}

/** 「PLL + ZBLL」。 */
export function mixTitle(puzzle: AlgPuzzle, sets: readonly string[]): string {
  return sets.map(s => setLabel(puzzle, s)).join(' + ');
}

/** `/alg/3x3/mix/run?sets=pll,zbll`(sets 已排序 ⟹ 同一组合永远同一个 URL)。 */
export function mixHref(puzzle: string, sets: readonly string[], leaf: 'run' | 'select'): string {
  return `/alg/${puzzle}/${MIX_SLUG}/${leaf}?sets=${[...sets].sort().join(',')}`;
}

/**
 * 装齐全部成员集的 case,按成员顺序拼成一条,并给每个 case 盖上 `srcSet`。
 * 某一套加载失败不拖垮整场(跳过它并在控制台留痕)—— 少一套还能练,整页空白不能忍。
 */
export async function loadMixCases(puzzle: AlgPuzzle, sets: readonly string[]): Promise<AlgCase[]> {
  const loaded = await Promise.all(sets.map(async slug => {
    try {
      const d = await loadAlg(puzzle, slug);
      return d.cases.map(c => ({ ...c, srcSet: slug }));
    } catch (e) {
      console.error('[alg-mix] loadAlg failed', puzzle, slug, e);
      return [];
    }
  }));
  return loaded.flat();
}
