'use client';

import { useContentRefreshKey } from '@/hooks/useContentRefreshKey';

/**
 * `/alg/<puzzle>/<set>/<seg>` 的落地分流。`<seg>` 可能是**子组**(`ur` / `u` / `a+`)
 * 也可能是**某张 case**(`ur3` / `s+b1` / `a+-eo`)—— 两者同层、slug 空间实测不撞。
 *
 * 本路由是**静态哨兵壳**(page.tsx 只预渲染 `_/_/_`,next.config rewrite 把所有真实
 * URL 引到它),所以 `useParams` 拿到的是 `_` 占位,真实 puzzle/set/seg 从 window.location 读。
 * 计时器宿主提供原训练路径及标准化参数；项目别名以宿主解析结果为准。
 * 整个 set 只加载一次:是子组就交给 {@link AlgCategoryView}(把已加载的数据当 initialData 传下去,
 * 不再拉),是 case 就交给 {@link AlgCaseView}。
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTrainingPathname as usePathname, useTrainingHost } from '@/lib/training-host';
import { getAlgSetMeta, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import { algLibraryKey, algLibraryGeneration, loadLibrarySource, subscribeAlgLibrary, peekAlgNavigationFile, rememberAlgNavigationVersion } from '@/lib/alg-library-cache';
import { warmAlgValidation } from '@/lib/alg_validation';
import { alignAlgSelection } from '@/lib/alg_case_alignment';
import AlgCategoryView from '@/components/AlgCategoryView';
import dynamic from 'next/dynamic';
const AlgCaseView = dynamic(() => import('./AlgCaseView'));
import { canonicalZbllSubgroupSlug } from '@/lib/alg_zbll_subgroups';
import { resolveCaseSlug } from '@/lib/alg_case_link';
import { tr } from '@/i18n/tr';
import '../../../alg.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
const noSubscription = () => () => {};
const serverPath = () => '';
const serverFile = () => null;

export default function AlgSubOrCaseClient() {
  const pathname = usePathname();
  const trainingHost = useTrainingHost();
  const hostPuzzle = firstParam(trainingHost?.params.puzzle);
  const hostSet = firstParam(trainingHost?.params.set);
  const hostSubgroup = firstParam(trainingHost?.params.subgroup);
  // Keep rewritten-route hydration stable, but read the real path immediately
  // on client navigation instead of painting an empty route for one effect.
  const routePath = useSyncExternalStore(noSubscription,
    useCallback(() => trainingHost?.path ?? window.location.pathname, [pathname, trainingHost?.path]), serverPath);
  const route = useMemo(() => {
    const m = routePath.match(/\/alg\/([^/]+)\/([^/]+)\/([^/?#]+)(?:\/(edit))?\/?$/);
    return m ? {
      puzzle: hostPuzzle ?? decodeURIComponent(m[1]),
      set: hostSet ?? decodeURIComponent(m[2]),
      slug: hostSubgroup ?? decodeURIComponent(m[3]),
      edit: m[4] === 'edit',
    } : null;
  }, [routePath, hostPuzzle, hostSet, hostSubgroup]);
  const puzzle = route?.puzzle ?? '';
  const set = route?.set ?? '';
  const slug = route?.slug ?? '';
  const refreshKey = useContentRefreshKey(!route?.edit);

  const prepared = useSyncExternalStore(noSubscription,
    useCallback(() => peekAlgNavigationFile(routePath), [routePath]), serverFile);
  const [loaded, setLoaded] = useState<{ path: string; file: AlgFile } | null>(null);
  const data = loaded?.path === routePath ? loaded.file : prepared;
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
    if (!puzzle || !set || !slug) return;
    let live = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      const generation = algLibraryGeneration(puzzle, set);
      void warmAlgValidation(puzzle).catch(() => {});
      loadLibrarySource(puzzle as AlgPuzzle, set).then(file => {
        const subSlug = canonicalZbllSubgroupSlug(set, slug.toLowerCase());
        const groupCase = file.cases.find(c => {
          const parts = (c.subgroup || '').toLowerCase().split('/');
          return parts[0] === subSlug || parts[1] === subSlug;
        });
        const top = getAlgSetMeta(puzzle as AlgPuzzle, set)?.umbrella
          ? groupCase?.subgroup?.split('/')[0].toLowerCase() : undefined;
        const selected = groupCase ? file.cases.filter(c => !top || c.subgroup?.split('/')[0].toLowerCase() === top) : [];
        const caseObj = selected.length ? null : resolveCaseSlug(file.cases, slug, puzzle, set);
        return alignAlgSelection(file, selected.length ? selected : caseObj ? [caseObj] : []);
      }).then(d => { if (live && request === revision) { setLoaded({ path: routePath, file: rememberAlgNavigationVersion(d, generation) }); setError(false); } })
        .catch(() => { if (live && request === revision) setError(true); });
    };
    const unsubscribe = subscribeAlgLibrary(algLibraryKey(puzzle, set), refresh);
    refresh();
    return () => { live = false; unsubscribe(); };
  }, [puzzle, set, slug, refreshKey, routePath]);

  if (error && !data) {
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '加载失败', en: 'Failed to load.' })}</div></div>;
  }
  if (!route || !data) {
    return <div className="alg-root"><div className="alg-empty"><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator></div></div>;
  }

  // 子组优先(含迁移前数字制别名 canonical 化)。命中 → 列表视图。
  const subSlug = canonicalZbllSubgroupSlug(set, slug.toLowerCase());
  const isSubgroup = data.cases.some(c => {
    const parts = (c.subgroup || '').toLowerCase().split('/');
    return parts[0] === subSlug || parts[1] === subSlug;
  });
  if (isSubgroup) {
    const top = getAlgSetMeta(puzzle as AlgPuzzle, set)?.umbrella
      ? data.cases.find(c => (c.subgroup || '').toLowerCase().split('/').includes(subSlug ?? ''))?.subgroup?.split('/')[0]
      : undefined;
    return <AlgCategoryView puzzleParam={puzzle} set={set} subgroupParam={top} initialData={data} />;
  }

  // 否则当 case 解析(slug 唯一表 + 手打名兜底)。
  const caseObj = resolveCaseSlug(data.cases, slug, puzzle, set);
  if (caseObj) {
    return <AlgCaseView puzzle={puzzle as AlgPuzzle} set={set} caseObj={caseObj} data={data} />;
  }
  return <div className="alg-root"><div className="alg-empty">{tr({ zh: '没找到这个 case', en: 'Case not found.' })}</div></div>;
}
