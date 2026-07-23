'use client';

/**
 * `/alg/<puzzle>/<set>/<seg>` 的落地分流。`<seg>` 可能是**子组**(`ur` / `u` / `a+`)
 * 也可能是**某张 case**(`ur3` / `s+b1` / `a+-eo`)—— 两者同层、slug 空间实测不撞。
 *
 * 本路由是**静态哨兵壳**(page.tsx 只预渲染 `_/_/_`,next.config rewrite 把所有真实
 * URL 引到它),所以 `useParams` 拿到的是 `_` 占位,真实 puzzle/set/seg 从 window.location 读。
 * 整个 set 只加载一次:是子组就交给 {@link AlgCategoryView}(把已加载的数据当 initialData 传下去,
 * 不再拉),是 case 就交给 {@link AlgCaseView}。
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadAlg, type AlgFile, type AlgPuzzle } from '@cuberoot/shared';
import AlgCategoryView from '@/components/AlgCategoryView';
import AlgCaseView from './AlgCaseView';
import { canonicalZbllSubgroupSlug } from '@/lib/alg_zbll_subgroups';
import { resolveCaseSlug } from '@/lib/alg_case_link';
import { tr } from '@/i18n/tr';
import '../../../alg.css';

export default function AlgSubOrCaseClient() {
  const pathname = usePathname();
  const [route, setRoute] = useState<{ puzzle: string; set: string; slug: string } | null>(null);
  useEffect(() => {
    const m = window.location.pathname.match(/\/alg\/([^/]+)\/([^/]+)\/([^/?#]+)/);
    setRoute(m ? {
      puzzle: decodeURIComponent(m[1]),
      set: decodeURIComponent(m[2]),
      slug: decodeURIComponent(m[3]),
    } : null);
  }, [pathname]);
  const puzzle = route?.puzzle ?? '';
  const set = route?.set ?? '';
  const slug = route?.slug ?? '';

  const [data, setData] = useState<AlgFile | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setData(null);
    setError(false);
    if (!puzzle || !set) return;
    let live = true;
    loadAlg(puzzle as AlgPuzzle, set)
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [puzzle, set]);

  if (error) {
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '加载失败', en: 'Failed to load.' })}</div></div>;
  }
  if (!route || !data) {
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div></div>;
  }

  // 子组优先(含迁移前数字制别名 canonical 化)。命中 → 列表视图。
  const subSlug = canonicalZbllSubgroupSlug(set, slug.toLowerCase());
  const isSubgroup = data.cases.some(c => {
    const parts = (c.subgroup || '').toLowerCase().split('/');
    return parts[0] === subSlug || parts[1] === subSlug;
  });
  if (isSubgroup) {
    return <AlgCategoryView puzzleParam={puzzle} set={set} subgroupParam={slug} initialData={data} />;
  }

  // 否则当 case 解析(slug 唯一表 + 手打名兜底)。
  const caseObj = resolveCaseSlug(data.cases, slug, puzzle, set);
  if (caseObj) {
    return <AlgCaseView puzzle={puzzle as AlgPuzzle} set={set} caseObj={caseObj} data={data} />;
  }
  return <div className="alg-root"><div className="alg-empty">{tr({ zh: '没找到这个 case', en: 'Case not found.' })}</div></div>;
}
