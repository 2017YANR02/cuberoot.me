'use client';

// 金字塔全空间精确枚举视图 —— 不含小角(tips)的完整状态空间 933,120 态、去重后 39,035 个本质状态
// (与 WCA 真题采样相对)。数据来自 scripts/build_pyram_essential.py 生成的静态 JSON。
// 总体(pop)由顶部数据源下拉(page.tsx 的 essSrc)选,与 2×2 同一个选择器 —— 原先本组件内嵌的
// 「总体」PillToggle 已废除,免得一页两个总体开关:
//   pop='all'(所有状态,933,120)  → full_h/full_v 边际 = 随机打乱的真实难度分布
//   pop='ess'(所有本质状态,39,035)→ h/v 边际 + 联合 V×H + 全量状态表(懒加载)+ V 首步状态图示
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { SortArrow } from '@/components/SortArrow';
import { ClearButton } from '@/components/ClearButton';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import PillToggle from '@/components/PillToggle/PillToggle';
import {
  fetchPyramEssential, fetchPyramEssentialCases, invertPyramAlg,
  type PyramEssentialJson, type PyramCaseRow,
} from '@/lib/essential-pyram';
import { tr } from '@/i18n/tr';
import FirstStepGallery, { type GalleryRow } from './FirstStepGallery';
import firstFacePyram from '../_data/firstface_pyram.json';
import './_essential-shared.css';

const GREEN = '#2ec27e'; // H(整解,与 pyram 图同色)
const BLUE = '#3d7bf0';  // V(V-first 首步)

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export default function PyraminxEssentialView({ isZh, pop }: { isZh: boolean; pop: 'all' | 'ess' }) {
  const [data, setData] = useState<PyramEssentialJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'h' | 'v'>('h');
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [cases, setCases] = useState<PyramCaseRow[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPyramEssential().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);

  const loadCases = () => {
    if (cases || casesLoading) return;
    setCasesLoading(true);
    fetchPyramEssentialCases()
      .then((d) => setCases(d.rows))
      .catch((e) => setCasesError(String(e)))
      .finally(() => setCasesLoading(false));
  };

  const mainCounts = useMemo(() => {
    if (!data) return null;
    if (pop === 'all') return metric === 'h' ? data.full_h.counts : data.full_v.counts;
    return metric === 'h' ? data.h.counts : data.v.counts;
  }, [data, metric, pop]);
  const mainSeries = useMemo<HistSeries[]>(() => {
    if (!mainCounts) return [];
    return [{ name: metric.toUpperCase(), fillColors: [metric === 'h' ? GREEN : BLUE], counts: mainCounts }];
  }, [mainCounts, metric]);
  // 中位数:counts 直方图的 50% 分位(均值走 meta 的精确值,不再另算)。
  const medianMain = useMemo(() => {
    if (!mainCounts) return undefined;
    const e = Object.entries(mainCounts).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0]);
    const total = e.reduce((s, [, v]) => s + v, 0);
    let c = 0;
    for (const [x, v] of e) { c += v; if (c >= total / 2) return x; }
    return undefined;
  }, [mainCounts]);

  const jointMax = useMemo(() => {
    if (!data) return 1;
    let m = 1;
    for (const row of data.joint.grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [data]);

  if (error) return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {error}</div>;
  if (!data) return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;

  const { meta } = data;
  const colTotals = data.joint.h.map((_, hi) => data.joint.grid.reduce((s, row) => s + (row[hi] ?? 0), 0));
  const avgMain = pop === 'all'
    ? (metric === 'h' ? meta.avg_h_full : meta.avg_v_full)
    : (metric === 'h' ? meta.avg_h : meta.avg_v);

  return (
    <div className="ess-view">
      {/* 概览:总数不在这里报 —— 图内已自报当前总体的样本数,这行只留口径说明。 */}
      <div className="scramble-stats-controls ess-overview">
        <div className="scramble-stats-puzzle-meta">
          <span className="scramble-stats-puzzle-metric">
            {pop === 'all'
              ? tr({
                zh: '不含小角(tips)的完整状态空间,精确枚举 —— 即随机打乱的真实难度分布',
                en: 'The full tip-less state space, exactly enumerated — the true difficulty distribution of a random scramble',
              })
              : tr({
                zh: '完整状态空间按旋转 / 镜像去重后的本质状态',
                en: 'The full state space deduped by rotation / mirror into essential states',
              })}
          </span>
        </div>
      </div>

      {/* 主分布:度量 H/V(总体由顶部数据源下拉选)*/}
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '度量', en: 'Metric' })}</span>
          <PillToggle
            value={metric === 'h'}
            onChange={(v) => setMetric(v ? 'h' : 'v')}
            onLabel={tr({ zh: '魔方', en: 'Full solve' })}
            offLabel={tr({ zh: 'V', en: 'V' })}
            ariaLabel={tr({ zh: '度量:整解 H 或 V-first 首步 V', en: 'Metric: full-solve H or V-first V' })}
          />
        </div>
      </div>
      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={mainSeries}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          // 两档分母不是一个总体(全空间状态 / 去重后的本质状态),「共 N」必须自报数的是什么。
          totalUnit={pop === 'all'
            ? { zh: '个状态', en: 'states' }
            : { zh: '个本质状态', en: 'essential states' }}
          meanValue={avgMain}
          medianValue={medianMain}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
        />
      </div>

      {/* 以下三块都是本质状态(39,035)口径的:Σ = essential_count,故只在 pop='ess' 出。 */}
      {pop === 'ess' && (
      <>
      {/* 联合 V×H 表(本质状态)*/}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-panel-title">{tr({ zh: '联合分布(V × H)', en: 'Joint distribution (V × H)' })}</div>
        <div className="ess-joint-scroll">
          <table className="ess-joint">
            <thead>
              <tr>
                <th className="ess-joint-corner">V\H</th>
                {data.joint.h.map((h) => <th key={h}>{h}</th>)}
                <th className="ess-joint-total">Σ</th>
              </tr>
            </thead>
            <tbody>
              {data.joint.v.map((v, vi) => {
                const row = data.joint.grid[vi];
                const rowTotal = row.reduce((s, x) => s + (x ?? 0), 0);
                return (
                  <tr key={v}>
                    <th className="ess-joint-rhead">{v}</th>
                    {data.joint.h.map((_, hi) => {
                      const x = row[hi] ?? 0;
                      const pct = x > 0 ? Math.round((Math.log(x) / Math.log(jointMax)) * 80) : 0;
                      return (
                        <td key={hi} style={x > 0 ? { background: `color-mix(in srgb, ${GREEN} ${pct}%, transparent)` } : undefined}>
                          {x > 0 ? compact(x) : ''}
                        </td>
                      );
                    })}
                    <td className="ess-joint-total">{compact(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="ess-joint-totalrow">
                <th className="ess-joint-rhead">Σ</th>
                {colTotals.map((t, i) => <td key={i} className="ess-joint-total">{compact(t)}</td>)}
                <td className="ess-joint-total">{compact(meta.essential_count)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="ess-note">
          {tr({
            zh: '行 = V-first 首步 V,列 = 整解 H;格子 = 该 (V, H) 的本质状态数(颜色越深越多)。',
            en: 'Rows = V-first V, columns = full-solve H; each cell = essential states at that (V, H) pair (darker = more).',
          })}
        </div>
      </div>

      {/* 本质状态库 */}
      <div className="scramble-stats-panel">
        {cases ? (
          <PyramCaseTable isZh={isZh} rows={cases} />
        ) : (
          <div className="ess-load">
            <button type="button" className="ess-load-btn" onClick={loadCases} disabled={casesLoading}>
              {casesLoading
                ? tr({ zh: '加载中…', en: 'Loading…' })
                : tr({ zh: '浏览全部 {n} 个状态', en: 'Browse all {n} states' }).replace('{n}', meta.essential_count.toLocaleString())}
            </button>
            {casesError && <span className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {casesError}</span>}
          </div>
        )}
      </div>

      {/* V 首步状态图示(无关块变灰,固定「V 缺口朝前」朝向)*/}
      <FirstStepGallery
        event="pyram"
        mask={firstFacePyram.meta.mask}
        rows={firstFacePyram.rows as unknown as GalleryRow[]}
        totalReorient={firstFacePyram.meta.total_reorient}
        totalMirror={firstFacePyram.meta.total_mirror_folded}
        metricLabel={{ zh: 'V', en: 'V' }}
      />
      </>
      )}

      {/* 致谢 */}
      <div className="scramble-stats-meta ess-credits">
        <span>
          {tr({ zh: '参考', en: 'ref.' })} <a href={meta.credits.source_url} target="_blank" rel="noopener noreferrer">Jaap Scherphuis</a>
        </span>
      </div>
    </div>
  );
}

// ── 全量状态表(懒加载后传入):搜公式/序号、按 V/H 过滤、任意列排序、分页 ──────────────────
type SortKey = 'idx' | 'V' | 'H';
const COL_IDX: Record<SortKey, number> = { idx: 0, V: 2, H: 3 };
const PAGE_SIZE = 50;

function uniqSorted(rows: PyramCaseRow[], col: number): number[] {
  const s = new Set<number>();
  for (const r of rows) s.add(r[col] as number);
  return [...s].sort((a, b) => a - b);
}

function PyramCaseTable({ isZh, rows }: { isZh: boolean; rows: PyramCaseRow[] }) {
  const [query, setQuery] = useState('');
  const [fV, setFV] = useState<number | 'all'>('all');
  const [fH, setFH] = useState<number | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('idx');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const vOpts = useMemo(() => uniqSorted(rows, 2), [rows]);
  const hOpts = useMemo(() => uniqSorted(rows, 3), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    const qNum = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;
    let out = rows;
    if (fV !== 'all') out = out.filter((r) => r[2] === fV);
    if (fH !== 'all') out = out.filter((r) => r[3] === fH);
    if (q) out = out.filter((r) => r[1].toLowerCase().replace(/\s+/g, '').includes(q) || (qNum !== null && r[0] === qNum));
    return out;
  }, [rows, query, fV, fH]);

  const sorted = useMemo(() => {
    const col = COL_IDX[sortKey];
    const dir = sortDir === 'asc' ? 1 : -1;
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
    <th className="ess-th-sort" aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} title={title}>
      <button type="button" className="ess-th-btn" onClick={() => toggleSort(k)}>
        {label}
        <SortArrow active={sortKey === k} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="ess-cases">
      <div className="ess-cases-controls">
        <div className="ess-search">
          <input
            className="ess-search-input"
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
        <label className="ess-filter">
          <span>V</span>
          <select className="scramble-stats-select" value={String(fV)}
            onChange={(e) => onFilterChange(() => setFV(e.target.value === 'all' ? 'all' : Number(e.target.value)))}>
            <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
            {vOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="ess-filter">
          <span>H</span>
          <select className="scramble-stats-select" value={String(fH)}
            onChange={(e) => onFilterChange(() => setFH(e.target.value === 'all' ? 'all' : Number(e.target.value)))}>
            <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
            {hOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <span className="ess-cases-count">
          {tr({ zh: '{n} 个状态', en: '{n} states' }).replace('{n}', sorted.length.toLocaleString())}
        </span>
      </div>

      <div className="ess-table-scroll sticky-scroll">
        <table className="ess-table sticky-thead">
          <thead>
            <tr>
              {th('idx', '#', tr({ zh: '难度序号(1 = 最难)', en: 'Difficulty rank (1 = hardest)' }))}
              <th>{tr({ zh: '状态', en: 'State' })}</th>
              <th className="ess-alg-th">{tr({ zh: '整解最优解', en: 'Optimal solution' })}</th>
              {th('V', 'V', tr({ zh: 'V-first 首步步数', en: 'V-first step' }))}
              {th('H', 'H', tr({ zh: '整解步数', en: 'Full-solve HTM*' }))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const [idx, alg, V, H] = r;
              const scramble = invertPyramAlg(alg);
              return (
                <tr key={idx}>
                  <td className="ess-num">{idx.toLocaleString()}</td>
                  <td className="ess-cube">
                    <Link
                      href={`/scramble/solver?event=pyram&scramble=${encodeURIComponent(scramble)}`}
                      prefetch={false}
                      aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
                    >
                      <ScramblePreview2D event="pyram" scramble={scramble} size={24} />
                    </Link>
                  </td>
                  <td className="ess-alg">{alg}</td>
                  <td className="ess-num">{V}</td>
                  <td className="ess-num">{H}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ess-pager">
        <button type="button" className="ess-pager-btn" disabled={curPage === 0} onClick={() => setPage(0)}>«</button>
        <button type="button" className="ess-pager-btn" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>‹</button>
        <span className="ess-pager-info">
          {tr({ zh: '第 {a} / {b} 页', en: 'Page {a} / {b}' }).replace('{a}', String(curPage + 1)).replace('{b}', String(pageCount))}
        </span>
        <button type="button" className="ess-pager-btn" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>›</button>
        <button type="button" className="ess-pager-btn" disabled={curPage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</button>
      </div>
    </div>
  );
}
