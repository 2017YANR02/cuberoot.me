'use client';

// 金字塔「所有本质状态」视图 —— 不含小角(tips)的完整状态空间 933,120 态、去重后 39,035 个本质案例的
// 精确统计(与 WCA 真题采样相对)。数据来自 scripts/build_pyram_essential.py 生成的静态 JSON。
//   full_h/full_v → 全空间(933,120)边际 = 随机打乱的真实难度分布(主分布)
//   h/v/joint     → 39,035 本质案例的 V/H 边际 + 联合 V×H(案例库结构)
//   cases         → 全量 39,035 案例(懒加载)
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
import './_essential-shared.css';

const GREEN = '#2ec27e'; // H(整解,与 pyram 图同色)
const BLUE = '#3d7bf0';  // V(V-first 首步)

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export default function PyraminxEssentialView({ isZh }: { isZh: boolean }) {
  const [data, setData] = useState<PyramEssentialJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'h' | 'v'>('h');
  const [pop, setPop] = useState<'full' | 'essential'>('full');
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
    if (pop === 'full') return metric === 'h' ? data.full_h.counts : data.full_v.counts;
    return metric === 'h' ? data.h.counts : data.v.counts;
  }, [data, metric, pop]);
  const mainSeries = useMemo<HistSeries[]>(() => {
    if (!mainCounts) return [];
    return [{ name: metric.toUpperCase(), fillColors: [metric === 'h' ? GREEN : BLUE], counts: mainCounts }];
  }, [mainCounts, metric]);

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
  const avgMain = pop === 'full'
    ? (metric === 'h' ? meta.avg_h_full : meta.avg_v_full)
    : (metric === 'h' ? meta.avg_h : meta.avg_v);

  return (
    <div className="ess-view">
      {/* 概览 */}
      <div className="scramble-stats-controls ess-overview">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: '{n} 个本质案例', en: '{n} essential cases' }).replace('{n}', meta.essential_count.toLocaleString())}</span>
          <span className="scramble-stats-puzzle-metric">
            {tr({
              zh: '不含小角(tips)的完整状态空间 {n} 态,精确枚举',
              en: 'The full tip-less state space ({n} states), exactly enumerated',
            }).replace('{n}', meta.total_positions.toLocaleString())}
          </span>
        </div>
      </div>

      <div className="scramble-stats-panel">
        <div className="scramble-stats-stat-grid">
          <Cell label={tr({ zh: '完整状态空间', en: 'Full state space' })} value={meta.total_positions.toLocaleString()} />
          <Cell label={tr({ zh: '本质案例', en: 'Essential cases' })} value={meta.essential_count.toLocaleString()} />
          <Cell label={tr({ zh: '上帝之数 H', en: "God's number H" })} value={String(meta.god_htm)} />
          <Cell label={tr({ zh: '最大 V', en: 'Max V' })} value={String(data.v.max)} />
          <Cell label={tr({ zh: '平均 H(全空间)', en: 'Mean H (all states)' })} value={meta.avg_h_full.toFixed(2)} />
          <Cell label={tr({ zh: '平均 V(全空间)', en: 'Mean V (all states)' })} value={meta.avg_v_full.toFixed(2)} />
        </div>
      </div>

      {/* 主分布:度量 H/V + 总体 全空间/本质 */}
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '度量', en: 'Metric' })}</span>
          <PillToggle
            value={metric === 'h'}
            onChange={(v) => setMetric(v ? 'h' : 'v')}
            onLabel={tr({ zh: 'H 整解', en: 'H full' })}
            offLabel={tr({ zh: 'V 首步', en: 'V step' })}
            ariaLabel={tr({ zh: '度量:整解 H 或 V-first 首步 V', en: 'Metric: full-solve H or V-first V' })}
          />
        </div>
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '总体', en: 'Population' })}</span>
          <PillToggle
            value={pop === 'full'}
            onChange={(v) => setPop(v ? 'full' : 'essential')}
            onLabel={tr({ zh: '全空间', en: 'All states' })}
            offLabel={tr({ zh: '本质案例', en: 'Essential' })}
            ariaLabel={tr({ zh: '总体:全 933,120 态或去重后本质案例', en: 'Population: all 933,120 states or deduped essential cases' })}
          />
        </div>
        <span className="scramble-stats-puzzle-metric">
          {metric === 'h'
            ? tr({ zh: 'H:整解最优步数(HTM*,不含小角;每个顶点转 1 步)', en: "H: full-solve optimal length (HTM*, tips ignored; each vertex turn = 1)" })
            : tr({ zh: 'V:先拼好 4 中心 + 2 相邻棱组成的 V(V-first 首步)', en: 'V: solve all 4 centers + 2 adjacent edges forming a V (V-first first step)' })}
          {` · ${tr({ zh: '平均', en: 'mean' })} ${avgMain.toFixed(2)}`}
        </span>
      </div>
      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={mainSeries}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
        />
      </div>

      {/* 联合 V×H 表(本质案例)*/}
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
            zh: '行 = V-first 首步 V,列 = 整解 H;格子 = 该 (V, H) 的本质案例数(颜色越深越多)。',
            en: 'Rows = V-first V, columns = full-solve H; each cell = essential cases at that (V, H) pair (darker = more).',
          })}
        </div>
      </div>

      {/* 案例库 */}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-panel-title">
          {tr({ zh: '案例库(去重后 {n} 个本质案例)', en: 'Case database ({n} unique essential cases)' }).replace('{n}', meta.essential_count.toLocaleString())}
        </div>
        {cases ? (
          <PyramCaseTable isZh={isZh} rows={cases} />
        ) : (
          <div className="ess-load">
            <button type="button" className="ess-load-btn" onClick={loadCases} disabled={casesLoading}>
              {casesLoading
                ? tr({ zh: '加载中…', en: 'Loading…' })
                : tr({ zh: '浏览全部 {n} 个案例', en: 'Browse all {n} cases' }).replace('{n}', meta.essential_count.toLocaleString())}
            </button>
            {casesError && <span className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {casesError}</span>}
          </div>
        )}
      </div>

      {/* 致谢 + 记号 */}
      <div className="scramble-stats-meta ess-credits">
        <span>
          {tr({ zh: '数据', en: 'Data' })}: {tr(meta.credits.author)} {tr(meta.credits.algorithm)}
          {' · '}{tr({ zh: '参考', en: 'ref.' })} <a href={meta.credits.source_url} target="_blank" rel="noopener noreferrer">Jaap Scherphuis</a>
          {' · '}{tr({ zh: '生成', en: 'Generated' })} {meta.generated_at}
        </span>
        <span className="ess-notation">
          {meta.notation.map((n) => `${n.sym} = ${tr(n)}`).join(isZh ? ';' : '; ')}
        </span>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="scramble-stats-stat-cell">
      <div className="scramble-stats-stat-label">{label}</div>
      <div className="scramble-stats-stat-value">{value}</div>
    </div>
  );
}

// ── 全量案例表(懒加载后传入):搜公式/序号、按 V/H 过滤、任意列排序、分页 ──────────────────
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
          {tr({ zh: '{n} 个案例', en: '{n} cases' }).replace('{n}', sorted.length.toLocaleString())}
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
                      href={`/scramble/pyraminx?scramble=${encodeURIComponent(scramble)}`}
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
