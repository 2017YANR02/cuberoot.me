'use client';

// 「所有本质状态」视图 —— 2×2×2 全 3,674,160 个本质状态的精确最优步数统计(与 WCA 真题采样
// 相对)。数据来自 scripts/build_2x2_essential.py 生成的静态 JSON。展示 xlsx 全部四张表的信息:
//   dist  → 主 HTM/QTM 分布 + 联合 HTM×QTM 表(本组件)
//   stat  → 首面 / 首层 6 组子分布
//   case  → 案例聚合(F/H/Q)+ 全量可搜索案例表(懒加载,Essential2x2CaseTable)
//   README→ 致谢 + 记号说明
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import PillToggle from '@/components/PillToggle/PillToggle';
import {
  fetchEssential2x2, fetchEssential2x2Cases,
  type Essential2x2Json, type EssCaseRow,
} from '@/lib/essential-2x2';
import { tr } from '@/i18n/tr';
import FirstStepGallery, { type GalleryRow } from './FirstStepGallery';
import firstFace2x2 from '../_data/firstface_2x2.json';
import './_essential-shared.css';

const Essential2x2CaseTable = dynamic(() => import('./Essential2x2CaseTable'), {
  ssr: false,
  loading: () => <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>,
});

const RED = '#f04f4f';   // 主分布(与 WCA 222 图同色,魔方红)
const BLUE = '#3d7bf0';  // 首面/首层子分布
const GREEN = '#2ec27e'; // 案例聚合

// 大数紧凑显示(热力表 / 标签):841500 → 842k,1.9e6 → 1.9M。
function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function statOf(counts: Record<string, number>) {
  const e = Object.entries(counts).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0]);
  if (!e.length) return null;
  let total = 0, sum = 0, mode = e[0][0], modeN = 0;
  for (const [x, v] of e) { total += v; sum += x * v; if (v > modeN) { modeN = v; mode = x; } }
  const pct = (p: number) => { const t = total * p; let c = 0; for (const [x, v] of e) { c += v; if (c >= t) return x; } return e[e.length - 1][0]; };
  return { mean: total ? sum / total : 0, median: pct(0.5), mode, min: e[0][0], max: e[e.length - 1][0], total };
}

export default function Essential2x2View({ isZh }: { isZh: boolean }) {
  const [data, setData] = useState<Essential2x2Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'htm' | 'qtm'>('htm');
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [statKey, setStatKey] = useState('CN FF');
  const [statY, setStatY] = useState<'percent' | 'count'>('percent');
  const [caseMetric, setCaseMetric] = useState<'F' | 'H' | 'Q' | 'QH'>('H');
  const [caseY, setCaseY] = useState<'percent' | 'count'>('percent');
  // 案例大文件(~5 MB)懒加载:仅当用户点「浏览全部案例」才拉。
  const [cases, setCases] = useState<EssCaseRow[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchEssential2x2().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);

  const loadCases = () => {
    if (cases || casesLoading) return;
    setCasesLoading(true);
    fetchEssential2x2Cases()
      .then((d) => setCases(d.rows))
      .catch((e) => setCasesError(String(e)))
      .finally(() => setCasesLoading(false));
  };

  const mainCounts = metric === 'htm' ? data?.htm.counts : data?.qtm.counts;
  const mainSeries = useMemo<HistSeries[]>(() => {
    if (!mainCounts) return [];
    return [{ name: metric.toUpperCase(), fillColors: [RED], counts: mainCounts }];
  }, [mainCounts, metric]);
  const mainStat = useMemo(() => (mainCounts ? statOf(mainCounts) : null), [mainCounts]);

  const statGroup = useMemo(() => data?.stat.groups.find((g) => g.key === statKey) ?? null, [data, statKey]);
  const statCounts = useMemo(() => {
    if (!statGroup) return null;
    const counts: Record<string, number> = {};
    for (const r of statGroup.rows) counts[String(r.m)] = r.cases;
    return counts;
  }, [statGroup]);
  const statSeries = useMemo<HistSeries[]>(() => {
    if (!statGroup || !statCounts) return [];
    return [{ name: statGroup.label.en, fillColors: [BLUE], counts: statCounts }];
  }, [statGroup, statCounts]);
  const statStat = useMemo(() => (statCounts ? statOf(statCounts) : null), [statCounts]);

  const caseCounts = data?.case_agg[caseMetric];
  const caseSeries = useMemo<HistSeries[]>(() => {
    if (!caseCounts) return [];
    return [{ name: caseMetric, fillColors: [GREEN], counts: caseCounts }];
  }, [caseCounts, caseMetric]);
  const caseStat = useMemo(() => (caseCounts ? statOf(caseCounts) : null), [caseCounts]);

  const jointMax = useMemo(() => {
    if (!data) return 1;
    let m = 1;
    for (const row of data.joint.grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [data]);

  if (error) return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {error}</div>;
  if (!data) return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;

  const { meta } = data;

  // 联合表列合计
  const colTotals = data.joint.htm.map((_, hi) => data.joint.grid.reduce((s, row) => s + (row[hi] ?? 0), 0));

  return (
    <div className="ess-view">
      {/* 状态总数不在这里报 —— 图内已自报(共 N);这里只留图上没有的口径 */}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-stat-grid">
          <Cell label={tr({ zh: '需 ≥4 HTM', en: '≥4 HTM' })} value={meta.wca_legal_min4h.toLocaleString()} />
        </div>
      </div>

      {/* 主分布:HTM / QTM 切换 */}
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '度量', en: 'Metric' })}</span>
          <PillToggle
            value={metric === 'htm'}
            onChange={(v) => setMetric(v ? 'htm' : 'qtm')}
            onLabel="HTM"
            offLabel="QTM"
            ariaLabel={tr({ zh: '度量:HTM 或 QTM', en: 'Metric: HTM or QTM' })}
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
          meanValue={mainStat?.mean}
          medianValue={mainStat?.median}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
        />
      </div>

      {/* 联合 HTM×QTM 表 */}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-panel-title">{tr({ zh: '联合分布(HTM × QTM)', en: 'Joint distribution (HTM × QTM)' })}</div>
        <div className="ess-joint-scroll">
          <table className="ess-joint">
            <thead>
              <tr>
                <th className="ess-joint-corner">Q\H</th>
                {data.joint.htm.map((h) => <th key={h}>{h}</th>)}
                <th className="ess-joint-total">Σ</th>
              </tr>
            </thead>
            <tbody>
              {data.joint.qtm.map((q, qi) => {
                const row = data.joint.grid[qi];
                const rowTotal = row.reduce((s, v) => s + (v ?? 0), 0);
                return (
                  <tr key={q}>
                    <th className="ess-joint-qhead">{q}</th>
                    {data.joint.htm.map((_, hi) => {
                      const v = row[hi] ?? 0;
                      const pct = v > 0 ? Math.round((Math.log(v) / Math.log(jointMax)) * 80) : 0;
                      return (
                        <td key={hi} style={v > 0 ? { background: `color-mix(in srgb, ${RED} ${pct}%, transparent)` } : undefined}>
                          {v > 0 ? compact(v) : ''}
                        </td>
                      );
                    })}
                    <td className="ess-joint-total">{compact(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="ess-joint-totalrow">
                <th className="ess-joint-qhead">Σ</th>
                {colTotals.map((t, i) => <td key={i} className="ess-joint-total">{compact(t)}</td>)}
                <td className="ess-joint-total">{compact(meta.total_positions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 首面 / 首层子分布(stat 表)*/}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-panel-title">{tr({ zh: '底面 / 首层步数分布', en: 'First-face / first-layer distributions' })}</div>
        <div className="ess-stat-controls">
          <label className="ess-filter">
            <span>{tr({ zh: '数据集', en: 'Dataset' })}</span>
            <select className="scramble-stats-select" value={statKey} onChange={(e) => setStatKey(e.target.value)}>
              {data.stat.groups.map((g) => (
                <option key={g.key} value={g.key}>{tr(g.label)}</option>
              ))}
            </select>
          </label>
        </div>
        {statGroup && (
          <>
            <div className="scramble-stats-chart-wrapper">
              <DiscreteHistogram
                series={statSeries}
                isZh={isZh}
                yMode={statY}
                chartMode="pdf"
                hideLegendColors
                meanValue={statStat?.mean}
                medianValue={statStat?.median}
                onYModeToggle={() => setStatY(statY === 'percent' ? 'count' : 'percent')}
              />
            </div>
          </>
        )}
        <div className="ess-note">
          {tr({
            zh: 'FF = 底面(把一个面拼成纯色);FL = 首层(整层复原);Fixed = 固定底色参照;CN = 色中性(六色任选取最优)。',
            en: 'FF = first face (one solid-color face); FL = first layer (a fully solved layer); Fixed = fixed reference color; CN = color-neutral (best over all 6 colors).',
          })}
          {data.stat.note ? ` · ${data.stat.note}` : ''}
        </div>
      </div>

      {/* 案例聚合(F/H/Q)*/}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-panel-title">{tr({ zh: '案例库(去重后 {n} 个本质案例)', en: 'Case database ({n} unique essential cases)' }).replace('{n}', data.case_agg.total.toLocaleString())}</div>
        <div className="ess-stat-controls">
          <label className="ess-filter">
            <span>{tr({ zh: '度量', en: 'Metric' })}</span>
            <select className="scramble-stats-select" value={caseMetric} onChange={(e) => setCaseMetric(e.target.value as 'F' | 'H' | 'Q' | 'QH')}>
              <option value="F">{tr({ zh: 'F(面转)', en: 'F (face)' })}</option>
              <option value="H">{tr({ zh: 'H(HTM)', en: 'H (HTM)' })}</option>
              <option value="Q">{tr({ zh: 'Q(QTM)', en: 'Q (QTM)' })}</option>
              <option value="QH">{tr({ zh: 'Q|H', en: 'Q|H' })}</option>
            </select>
          </label>
        </div>
        <div className="scramble-stats-chart-wrapper">
          <DiscreteHistogram
            series={caseSeries}
            isZh={isZh}
            yMode={caseY}
            chartMode="pdf"
            hideLegendColors
            meanValue={caseStat?.mean}
            medianValue={caseStat?.median}
            onYModeToggle={() => setCaseY(caseY === 'percent' ? 'count' : 'percent')}
          />
        </div>
        {/* HTM 最优解是否同时是 QTM 最优解 */}
        <div className="ess-dqhq">
          <span className="ess-dqhq-title">{tr({ zh: 'HTM 最优解的 QTM 代价', en: 'QTM cost of the HTM-optimal solution' })}:</span>
          {Object.entries(data.case_agg.dqhq).map(([d, n]) => (
            <span key={d} className="ess-dqhq-item">
              {d === '0'
                ? tr({ zh: '同时最优 {p}%', en: 'also optimal {p}%' }).replace('{p}', ((n / data.case_agg.total) * 100).toFixed(1))
                : tr({ zh: '多 {d}Q:{p}%', en: '+{d}Q: {p}%' }).replace('{d}', d).replace('{p}', ((n / data.case_agg.total) * 100).toFixed(1))}
            </span>
          ))}
        </div>

        {/* 全量案例表:懒加载 */}
        {cases ? (
          <Essential2x2CaseTable isZh={isZh} rows={cases} />
        ) : (
          <div className="ess-load">
            <button type="button" className="ess-load-btn" onClick={loadCases} disabled={casesLoading}>
              {casesLoading
                ? tr({ zh: '加载中…', en: 'Loading…' })
                : tr({ zh: '浏览全部 {n} 个案例(约 5 MB)', en: 'Browse all {n} cases (~5 MB)' }).replace('{n}', data.case_agg.total.toLocaleString())}
            </button>
            {casesError && <span className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {casesError}</span>}
          </div>
        )}
      </div>

      {/* 首面案例画廊(无关块变灰)*/}
      <FirstStepGallery
        event="222"
        mask={firstFace2x2.meta.mask}
        rows={firstFace2x2.rows as unknown as GalleryRow[]}
        totalReorient={firstFace2x2.meta.total_reorient}
        totalMirror={firstFace2x2.meta.total_mirror_folded}
        metricLabel={{ zh: '底面', en: 'Face' }}
      />

      {/* 致谢 */}
      <div className="scramble-stats-meta ess-credits">
        <span>
          {tr({ zh: '参考', en: 'ref.' })} <a href={meta.credits.source_url} target="_blank" rel="noopener noreferrer">Jaap Scherphuis</a>
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
