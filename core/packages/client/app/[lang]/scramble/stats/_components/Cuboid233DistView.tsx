'use client';

// 2×3×3 多米诺(233)整解【最优】步数分布 —— **离线预计算的采样直方图**(非全空间精确曲线)。
// 状态空间 = 1,625,702,400(8!·8!,角棱奇偶独立),太大无法整图枚举。分布由 build 脚本
// (scramble-stats-build/src/build_puzzle_sampled_dist.ts)**离线**采 N 个 cstimer 同款随机打乱、逐条用本站
// IDA* 求 **可证最优** 解(max(角距离, 棱距离) 可采纳启发式 → 每条都是真正最短)、把解的步数分桶,落静态
// stats/scramble/dist_233.json;本页**只 fetch + 渲染**,进页不做任何求解(铁律:TIER C/D 分布严禁浏览器现场采样)。
// 每条解可证最优,但整条曲线是抽样估计、不是全空间精确分布。下载样本来自 JSON 内嵌的 generatedSamples。
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';

const C233_COLOR = '#0ea5e9';   // 数据天蓝(非 UI 灰阶)
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

export default function Cuboid233DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [json, setJson] = useState<DistJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(statsUrl('/stats/scramble/dist_233.json') + `?v=${V}`)
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
    return { mean: json.mean, median: json.median, mode, min: json.min, max: json.max };
  }, [json, counts]);

  const exampleBins = useMemo(
    () => [...examplesByLen.keys()].sort((a, b) => a - b),
    [examplesByLen],
  );

  const effectiveBin = selectedBin
    ?? (stats && examplesByLen.has(stats.mode) ? stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin !== null ? (examplesByLen.get(effectiveBin) ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: '233', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '2×3×3 多米诺(采样,最优)', en: '2×3×3 Domino (sampled, optimal)' }),
    fillColors: [C233_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['optimal_length,scramble'];
    for (const s of json?.generatedSamples ?? []) lines.push(`${s.length},${s.scramble}`);
    downloadText('233_domino_sample.csv', lines.join('\n'));
  };

  const stateCountStr = json?.stateCountStr ?? '1,625,702,400';

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
              zh: '随机态样本(离线预计算,IDA* 可证最优,非全空间)',
              en: 'random-state samples (precomputed offline, IDA* provably optimal, not full-space)',
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一个 token = 1 步(IDA* 最优)', en: 'one token = 1 move (IDA* optimal)' })}</span>
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
          meanValue={stats?.mean}
          medianValue={stats?.median}
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
                  <ScramblePreview2D event="233" scramble={scr} size={26} />
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

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是采样估计的【最优】解长度分布:每条解都是可证最短(IDA* + max(角距离, 棱距离) 可采纳启发式),但整条曲线是抽样的、不是全空间精确分布 —— 2×3×3 多米诺有 ${stateCountStr} 个状态(8 角 × 8 棱,各自由排列,角棱奇偶独立),太大无法整图枚举,所以 build 脚本离线生成并解了 ${sampleCount.toLocaleString()} 个随机态,把解的步数分桶(样本量越大分布越稳);页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
            en: `This is a SAMPLED estimate of the OPTIMAL solution-length distribution: every solution is a provable shortest path (IDA* with the admissible max(corner-distance, edge-distance) heuristic), but the whole curve is sampled, not the exact full-space distribution — the 2×3×3 Domino has ${stateCountStr} states (8 corners × 8 edges, each freely permuted with independent parities), far too many to enumerate, so a build script generated and solved ${sampleCount.toLocaleString()} random states offline and bucketed them (a larger sample stabilizes the curve); this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles.`,
          })}
        </span>
        <span>{tr({ zh: '生成时间', en: 'Generated' })}: {json.generated_at}</span>
      </div>
    </>
  );
}
