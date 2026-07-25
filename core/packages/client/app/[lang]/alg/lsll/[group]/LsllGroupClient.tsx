'use client';

/**
 * /alg/lsll/[group] — 大类内浏览:枚举全部 case(客户端组合数学生成,无后端),
 * 翻棱数筛选 + 分页。case 缩略图为精确贴纸态(FaceletsCube)。
 *
 * 「图 / 公式」开关同全站(AlgViewModeToggle)。本页没有公式库,公式**现算**:
 * setupForCase 出打乱(cubing.js 两阶段解取逆),再取一次逆就是一条有效解法 ——
 * 与 /alg/lsll/train 的揭示同一条路子,不新造数据源。一页 48 个,逐个串行算,
 * 算好一个贴一个;算过的进模块级缓存,翻回来不重算。
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryState, parseAsInteger } from 'nuqs';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import AlgViewModeToggle, { useAlgViewMode } from '@/components/AlgViewModeToggle';
import {
  categoryBySlug, enumerateCategory, unpackState, classify, caseFacelets, keyToString,
} from '@/lib/lsll/model';
import { setupForCase, solutionForSetup } from '@/lib/lsll/setup';
import '../../alg.css';
import '../lsll.css';

const PAGE_SIZE = 48;

/** case key → 解法。跨翻页 / 跨切视图复用(一次两阶段解 ≈ 百毫秒级,别重复付)。 */
const SOLUTION_CACHE = new Map<number, string>();

export default function LsllGroupClient() {
  const params = useParams<{ group: string }>();
  const slug = typeof params?.group === 'string' ? params.group : '';
  const cat = categoryBySlug(slug);
  useDocumentTitle(cat ? `LSLL ${cat.letter}` : 'LSLL', cat ? `LSLL ${cat.letter}` : 'LSLL');

  const [eoBad, setEoBad] = useQueryState('eo', parseAsInteger.withDefault(-1));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [view, changeView] = useAlgViewMode();

  // 全类枚举一次(memo);再按翻棱数过滤。
  const allKeys = useMemo(() => (cat ? enumerateCategory(cat.slug) : []), [cat]);
  const withMeta = useMemo(
    () => allKeys.map((k) => ({ k, eoBad: classify(unpackState(k)).eoBad })),
    [allKeys],
  );
  const eoValues = useMemo(() => {
    const m = new Map<number, number>();
    for (const x of withMeta) m.set(x.eoBad, (m.get(x.eoBad) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [withMeta]);
  const filtered = useMemo(
    () => (eoBad < 0 ? withMeta : withMeta.filter((x) => x.eoBad === eoBad)),
    [withMeta, eoBad],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(Math.max(1, page), pageCount);
  const slice = useMemo(
    () => filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE),
    [filtered, cur],
  );

  /** 本页已算出的解法(`''` = 算失败)。只在公式模式下填。 */
  const [solutions, setSolutions] = useState<Record<number, string>>({});
  useEffect(() => {
    if (view !== 'full') return;
    let cancelled = false;
    // 缓存里已有的先贴上(翻页回来 / 图↔公式来回切,不该再等一遍)
    const seeded: Record<number, string> = {};
    for (const { k } of slice) {
      const hit = SOLUTION_CACHE.get(k);
      if (hit !== undefined) seeded[k] = hit;
    }
    if (Object.keys(seeded).length) setSolutions((prev) => ({ ...prev, ...seeded }));
    void (async () => {
      for (const { k } of slice) {
        if (cancelled) return;
        if (SOLUTION_CACHE.has(k)) continue;
        let sol = '';
        try {
          sol = solutionForSetup(await setupForCase(unpackState(k)));
        } catch {
          sol = ''; // setup 生成失败(极少见:桥接自检不过)→ 该卡显示「不可用」
        }
        SOLUTION_CACHE.set(k, sol);
        if (cancelled) return;
        setSolutions((prev) => ({ ...prev, [k]: sol }));
      }
    })();
    return () => { cancelled = true; };
  }, [view, slice]);

  const pending = view === 'full' ? slice.filter(({ k }) => solutions[k] === undefined).length : 0;

  if (!cat) {
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '未知大类', en: 'Unknown family' })}</div></div>;
  }

  const showAlgs = view === 'full';

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg/lsll" className="alg-back">
          <ArrowLeft size={14} /> LSLL
        </Link>
        <h1 className="alg-cat-title">
          <span>{cat.letter} <span className="alg-cat-count">{cat.count.toLocaleString()} {tr({ zh: '个', en: 'cases' })}</span></span>
        </h1>
        <AlgViewModeToggle value={view} onChange={changeView} className="alg-view-toggle" />
      </div>

      <div className="lsll-chips">
        <span className="lsll-chips-label">{tr({ zh: '顶层翻棱', en: 'Bad edges' })}</span>
        <button
          type="button"
          className={`lsll-chip${eoBad < 0 ? ' active' : ''}`}
          onClick={() => { setEoBad(-1); setPage(1); }}
        >
          {tr({ zh: '全部', en: 'All' })}
        </button>
        {eoValues.map(([v, n]) => (
          <button
            key={v}
            type="button"
            className={`lsll-chip${eoBad === v ? ' active' : ''}`}
            onClick={() => { setEoBad(v); setPage(1); }}
          >
            {v} ({n.toLocaleString()})
          </button>
        ))}
      </div>

      {showAlgs && (
        <p className="lsll-alg-note">
          {pending > 0
            ? tr({ zh: `解法生成中 ${slice.length - pending} / ${slice.length}`, en: `Solving ${slice.length - pending} / ${slice.length}` })
            : tr({ zh: '机器两阶段解:能解开,但没优化步数和指法。', en: 'Machine two-phase solutions: valid, but not move- or fingertrick-optimised.' })}
        </p>
      )}

      <div className={`lsll-case-grid${showAlgs ? ' is-algs' : ''}`}>
        {slice.map(({ k }, i) => {
          const ks = keyToString(k);
          const sol = solutions[k];
          return (
            <Link
              key={k}
              href={`/alg/lsll/case?k=${ks}`}
              className={`lsll-case-card${showAlgs ? ' is-algs' : ''}`}
              prefetch={false}
            >
              <FaceletsCube fd={caseFacelets(unpackState(k))} size={88} alt={`#${ks}`} />
              <span className="lsll-case-body">
                <span className="lsll-case-label">#{(cur - 1) * PAGE_SIZE + i + 1}</span>
                {showAlgs && (
                  <span className="lsll-case-alg">
                    {sol === undefined
                      ? tr({ zh: '生成中…', en: 'Solving…' })
                      : sol || tr({ zh: '(不可用)', en: '(unavailable)' })}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="lsll-pager">
        <button type="button" className="lsll-pager-btn" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
          {tr({ zh: '上一页', en: 'Prev' })}
        </button>
        <span>{cur} / {pageCount.toLocaleString()}</span>
        <button type="button" className="lsll-pager-btn" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>
          {tr({ zh: '下一页', en: 'Next' })}
        </button>
        <span>{filtered.length.toLocaleString()} {tr({ zh: '个匹配', en: 'matched' })}</span>
      </div>
    </div>
  );
}
