'use client';

// 3×3×6(336)解步数分布 —— **离线预计算的采样直方图**(非全空间精确曲线):3×3×6 状态空间
// ≈ 8,391,762,413,094,961,152,000,000(facelet 群阶 2,148,291,177,752,310,054,912,000,000,Schreier-Sims 实算),
// 太大无法整图枚举。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条
// 有界的近最优解(很浅的态另给可证最优解)。分布由 build 脚本(scramble-stats-build/src/build_puzzle_sampled_dist.ts)
// **离线**采 N 个 cstimer 同款随机打乱、逐条求解、把返回解步数分桶,落静态 stats/scramble/dist_336.json;本页**只 fetch +
// 渲染**,进页不做任何求解(铁律:TIER C/D 分布严禁浏览器现场采样)。下载样本来自 JSON 内嵌的 generatedSamples。
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';

const C336_COLOR = '#0ea5e9';   // 数据天蓝(非 UI 灰阶)
// shape 变更或数据重算时 bump(防缓存旧 JSON)。
const V = '20260621';

// dist_<event>.json 数据契约(见 build_puzzle_sampled_dist.ts;改 shape 两处同步 + bump V)。
interface DistJson {
  event: string;
  label: string;
  sampleCount: number;
  scrambleLen: number;
  quality: string;
  histogram: Record<string, number>; // 步数 -> 条数(sum === sampleCount)
  mean: number;
  median: number;
  min: number;
  max: number;
  maxBound?: number;
  optimalCount?: number;
  stateCountStr?: string;
  groupOrderStr?: string;
  generatedSamples: { length: number; scramble: string; optimal: boolean }[];
  generated_at: string;
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Cuboid336DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [json, setJson] = useState<DistJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(statsUrl('/stats/scramble/dist_336.json') + `?v=${V}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<DistJson>; })
      .then((d) => { if (alive) setJson(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);

  const counts = json?.histogram ?? {};
  const sampleCount = json?.sampleCount ?? 0;

  // 每个步数桶的示例打乱(来自内嵌样本;无现场求解)。
  const examplesByLen = useMemo<Map<number, string[]>>(() => {
    const m = new Map<number, string[]>();
    for (const s of json?.generatedSamples ?? []) {
      const arr = m.get(s.length) ?? [];
      if (arr.length < 12) { arr.push(s.scramble); m.set(s.length, arr); }
    }
    return m;
  }, [json]);

  const stats = useMemo(() => {
    if (!json) return null;
    let mode = json.min, modeN = 0;
    for (const [len, n] of Object.entries(counts)) if (n > modeN) { modeN = n; mode = Number(len); }
    const optPct = sampleCount > 0 ? (100 * (json.optimalCount ?? 0)) / sampleCount : 0;
    return { mean: json.mean, median: json.median, mode, min: json.min, max: json.max, optPct };
  }, [json, counts, sampleCount]);

  const exampleBins = useMemo(
    () => [...examplesByLen.keys()].sort((a, b) => a - b),
    [examplesByLen],
  );

  const effectiveBin = selectedBin
    ?? (stats && examplesByLen.has(stats.mode) ? stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin !== null ? (examplesByLen.get(effectiveBin) ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: '336', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '3×3×6(采样,近最优,非全空间)', en: '3×3×6 (sampled, near-optimal, not full-space)' }),
    fillColors: [C336_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['length,scramble,optimal'];
    for (const s of json?.generatedSamples ?? []) lines.push(`${s.length},${s.scramble},${s.optimal ? 1 : 0}`);
    downloadText('336_sample.csv', lines.join('\n'));
  };

  const stateCountStr = json?.stateCountStr ?? '8,391,762,413,094,961,152,000,000';
  const groupOrderStr = json?.groupOrderStr ?? '2,148,291,177,752,310,054,912,000,000';

  if (error) {
    return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {error}</div>;
  }
  if (!json) {
    return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;
  }

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>
            {tr({
              zh: `${sampleCount.toLocaleString()} 个随机打乱样本(离线预计算,两阶段近最优,非全空间)`,
              en: `${sampleCount.toLocaleString()} random-scramble samples (precomputed offline, two-phase near-optimal, not full-space)`,
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一个 token = 1 步', en: 'one token = 1 move' })}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ivy-dl-all" onClick={downloadSample} disabled={(json.generatedSamples?.length ?? 0) === 0}>
            <Download size={14} aria-hidden />
            {tr({ zh: '下载样本 (CSV)', en: 'Download sample (CSV)' })}
          </button>
        </div>
      </div>

      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={series}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          clickableBins={exampleBins}
          selectedBin={effectiveBin}
          onBarClick={(b) => setSelectedBin(b)}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          yModeLabel={yMode === 'percent' ? tr({ zh: '百分比', en: '%' }) : tr({ zh: '数量', en: 'count' })}
        />
      </div>

      {effectiveBin !== null && shown.length > 0 && (
        <div className="scramble-stats-panel scramble-stats-examples-panel">
          <div className="scramble-stats-examples-header">
            <div className="scramble-stats-panel-title">
              {tr({ zh: '{n} 步示例', en: '{n}-move examples' }).replace('{n}', String(effectiveBin))}
            </div>
          </div>
          <ul className="scramble-stats-examples-list">
            {shown.map((scr, i) => (
              <li key={i}>
                <Link
                  className="scramble-stats-examples-cube"
                  href={solverHref(scr)}
                  prefetch={false}
                  aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
                >
                  <ScramblePreview2D event="336" scramble={scr} size={26} />
                </Link>
                <div className="scramble-stats-examples-body">
                  <Link className="scramble-stats-examples-scramble" href={solverHref(scr)} prefetch={false}>
                    {scr}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(随机态样本,两阶段近最优)', en: 'Summary stats (random-state sample, two-phase near-optimal)' })}</div>
          <div className="scramble-stats-stat-grid">
            <Cell label={tr({ zh: '样本均值', en: 'sample mean' })} value={stats.mean.toFixed(1)} />
            <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(stats.median)} />
            <Cell label={tr({ zh: '最小', en: 'min' })} value={String(stats.min)} />
            <Cell label={tr({ zh: '最大', en: 'max' })} value={String(stats.max)} />
            <Cell label={tr({ zh: '可证最优占比', en: 'proven-optimal %' })} value={`${stats.optPct.toFixed(0)}%`} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×6 有 ${stateCountStr} 个状态(facelet 群阶 ${groupOrderStr},均为 Schreier-Sims 实算),太大无法整图枚举。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。所以 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解,把返回解的步数分桶 —— 主要是近最优、浅态为最优;页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。`,
            en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×6 has ${stateCountStr} states (facelet group order ${groupOrderStr}, both computed by Schreier-Sims), far too many to enumerate. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). So a build script solves ${sampleCount.toLocaleString()} cstimer-style random scrambles offline and buckets their returned lengths — mostly near-optimal, optimal for shallow states; this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed.`,
          })}
        </span>
        <span>{tr({ zh: '生成时间', en: 'Generated' })}: {json.generated_at}</span>
      </div>
    </>
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
