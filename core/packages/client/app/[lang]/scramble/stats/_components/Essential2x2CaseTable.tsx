'use client';

// 「所有本质状态」案例库全量可搜索表格 —— 77,801 个去重后的本质 2×2 案例,每条带 HTM 最优解
// 与 QTM 最优解及 F/H/Q 步数。支持公式子串搜索、按 F/H/Q 过滤、任意列排序、分页。数据由
// Essential2x2View 懒加载(约 5 MB)后传入。
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { SortArrow } from '@/components/SortArrow';
import { ClearButton } from '@/components/ClearButton';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { invertAlg, type EssCaseRow } from '@/lib/essential-2x2';
import { tr } from '@/i18n/tr';

type SortKey = 'idx' | 'F' | 'H' | 'QH' | 'Q' | 'dqhq';
const COL_IDX: Record<SortKey, number> = { idx: 0, F: 2, H: 3, QH: 4, Q: 5, dqhq: 8 };
const PAGE_SIZE = 50;

function uniqSorted(rows: EssCaseRow[], col: number): number[] {
  const s = new Set<number>();
  for (const r of rows) s.add(r[col] as number);
  return [...s].sort((a, b) => a - b);
}

export default function Essential2x2CaseTable({ isZh, rows }: { isZh: boolean; rows: EssCaseRow[] }) {
  const [query, setQuery] = useState('');
  const [fF, setFF] = useState<number | 'all'>('all');
  const [fH, setFH] = useState<number | 'all'>('all');
  const [fQ, setFQ] = useState<number | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('idx');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const fOpts = useMemo(() => uniqSorted(rows, 2), [rows]);
  const hOpts = useMemo(() => uniqSorted(rows, 3), [rows]);
  const qOpts = useMemo(() => uniqSorted(rows, 5), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    const qNum = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;
    let out = rows;
    if (fF !== 'all') out = out.filter((r) => r[2] === fF);
    if (fH !== 'all') out = out.filter((r) => r[3] === fH);
    if (fQ !== 'all') out = out.filter((r) => r[5] === fQ);
    if (q) {
      out = out.filter((r) => {
        const h = r[1].toLowerCase().replace(/\s+/g, '');
        const qa = (r[6] ?? r[1]).toLowerCase().replace(/\s+/g, '');
        return h.includes(q) || qa.includes(q) || (qNum !== null && r[0] === qNum);
      });
    }
    return out;
  }, [rows, query, fF, fH, fQ]);

  const sorted = useMemo(() => {
    const col = COL_IDX[sortKey];
    const dir = sortDir === 'asc' ? 1 : -1;
    // idx 已升序(最难在前),默认不重排以省时;其余列复制后排序,tie 用 idx 稳定。
    if (sortKey === 'idx' && sortDir === 'asc') return filtered;
    return [...filtered].sort((a, b) => {
      const d = ((a[col] as number) - (b[col] as number)) * dir;
      return d !== 0 ? d : (a[0] as number) - (b[0] as number);
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const curPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => sorted.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE),
    [sorted, curPage],
  );

  const toggleSort = (k: SortKey) => {
    setPage(0);
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'idx' ? 'asc' : 'desc'); }
  };
  const onFilterChange = (fn: () => void) => { fn(); setPage(0); };

  const th = (k: SortKey, label: string, title?: string) => (
    <th
      className="ess2-th-sort"
      aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button type="button" className="ess2-th-btn" onClick={() => toggleSort(k)}>
        {label}
        <SortArrow active={sortKey === k} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="ess2-cases">
      <div className="ess2-cases-controls">
        <div className="ess2-search">
          <input
            className="ess2-search-input"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder={tr({ zh: '搜公式 / 序号', en: 'Search alg / index' })}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {query && <ClearButton onClick={() => { setQuery(''); setPage(0); }} isZh={isZh} />}
        </div>
        <label className="ess2-filter">
          <span>F</span>
          <select className="scramble-stats-select" value={String(fF)}
            onChange={(e) => onFilterChange(() => setFF(e.target.value === 'all' ? 'all' : Number(e.target.value)))}>
            <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
            {fOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="ess2-filter">
          <span>H</span>
          <select className="scramble-stats-select" value={String(fH)}
            onChange={(e) => onFilterChange(() => setFH(e.target.value === 'all' ? 'all' : Number(e.target.value)))}>
            <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
            {hOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="ess2-filter">
          <span>Q</span>
          <select className="scramble-stats-select" value={String(fQ)}
            onChange={(e) => onFilterChange(() => setFQ(e.target.value === 'all' ? 'all' : Number(e.target.value)))}>
            <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
            {qOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <span className="ess2-cases-count">
          {tr({ zh: '{n} 个案例', en: '{n} cases' }).replace('{n}', sorted.length.toLocaleString())}
        </span>
      </div>

      <div className="ess2-table-scroll sticky-scroll">
        <table className="ess2-table sticky-thead">
          <thead>
            <tr>
              {th('idx', '#', tr({ zh: '难度序号(1 = 最难)', en: 'Difficulty rank (1 = hardest)' }))}
              <th>{tr({ zh: '状态', en: 'State' })}</th>
              <th className="ess2-alg-th">{tr({ zh: 'HTM 最优解', en: 'HTM-optimal' })}</th>
              {th('F', 'F', tr({ zh: '面转步数', en: 'Face turns' }))}
              {th('H', 'H', tr({ zh: 'HTM 步数', en: 'HTM' }))}
              {th('QH', 'Q|H', tr({ zh: '该 HTM 最优解的 QTM 步数', en: 'QTM length of that HTM-optimal solution' }))}
              {th('Q', 'Q', tr({ zh: 'QTM 最优步数', en: 'QTM-optimal' }))}
              <th className="ess2-alg-th">{tr({ zh: 'QTM 最优解', en: 'QTM-optimal' })}</th>
              {th('dqhq', 'Δ', tr({ zh: '(Q|H)−Q:HTM 最优解多花的四分之一转数', en: '(Q|H)−Q: extra quarter turns of the HTM-optimal solution' }))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const [idx, hAlg, F, H, QH, Q, qAlg, f6, dqhq] = r;
              const scramble = invertAlg(hAlg);
              return (
                <tr key={idx}>
                  <td className="ess2-num">{idx.toLocaleString()}</td>
                  <td className="ess2-cube">
                    <Link
                      href={`/scramble/222?scramble=${encodeURIComponent(scramble)}`}
                      prefetch={false}
                      aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
                    >
                      <ScramblePreview2D event="222" scramble={scramble} size={22} />
                    </Link>
                  </td>
                  <td className="ess2-alg">{hAlg}</td>
                  <td className="ess2-num" title={f6 ? `F1–F6: ${f6.join(' ')}` : undefined}>
                    {F}{f6 ? '*' : ''}
                  </td>
                  <td className="ess2-num">{H}</td>
                  <td className="ess2-num">{QH}</td>
                  <td className="ess2-num">{Q}</td>
                  <td className="ess2-alg ess2-alg-q">{qAlg ?? tr({ zh: '(同左)', en: '(same)' })}</td>
                  <td className="ess2-num ess2-delta" data-nonzero={dqhq > 0}>{dqhq > 0 ? `+${dqhq}` : '0'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ess2-pager">
        <button type="button" className="ess2-pager-btn" disabled={curPage === 0} onClick={() => setPage(0)}>«</button>
        <button type="button" className="ess2-pager-btn" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>‹</button>
        <span className="ess2-pager-info">
          {tr({ zh: '第 {a} / {b} 页', en: 'Page {a} / {b}' })
            .replace('{a}', String(curPage + 1)).replace('{b}', String(pageCount))}
        </span>
        <button type="button" className="ess2-pager-btn" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>›</button>
        <button type="button" className="ess2-pager-btn" disabled={curPage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</button>
      </div>
    </div>
  );
}
