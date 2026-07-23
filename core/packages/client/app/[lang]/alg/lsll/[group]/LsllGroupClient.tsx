'use client';

/**
 * /alg/lsll/[group] — 大类内浏览:枚举全部 case(客户端组合数学生成,无后端),
 * 翻棱数筛选 + 分页。case 缩略图为精确贴纸态(FaceletsCube)。
 */
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQueryState, parseAsInteger } from 'nuqs';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import {
  categoryBySlug, enumerateCategory, unpackState, classify, caseFacelets, keyToString,
} from '@/lib/lsll/model';
import '../../alg.css';
import '../lsll.css';

const PAGE_SIZE = 48;

export default function LsllGroupClient() {
  const params = useParams<{ group: string }>();
  const slug = typeof params?.group === 'string' ? params.group : '';
  const cat = categoryBySlug(slug);
  useDocumentTitle(cat ? `LSLL ${cat.letter}` : 'LSLL', cat ? `LSLL ${cat.letter}` : 'LSLL');

  const [eoBad, setEoBad] = useQueryState('eo', parseAsInteger.withDefault(-1));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

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

  if (!cat) {
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '未知大类', en: 'Unknown family' })}</div></div>;
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(Math.max(1, page), pageCount);
  const slice = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg/lsll" className="alg-back">
          <ArrowLeft size={14} /> LSLL
        </Link>
        <h1 className="alg-cat-title">
          <span>{cat.letter} <span className="alg-cat-count">{cat.count.toLocaleString()} {tr({ zh: '个', en: 'cases' })}</span></span>
        </h1>
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

      <div className="lsll-case-grid">
        {slice.map(({ k }, i) => {
          const ks = keyToString(k);
          return (
            <Link key={k} href={`/alg/lsll/case?k=${ks}`} className="lsll-case-card" prefetch={false}>
              <FaceletsCube fd={caseFacelets(unpackState(k))} size={88} alt={`#${ks}`} />
              <span className="lsll-case-label">#{(cur - 1) * PAGE_SIZE + i + 1}</span>
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
