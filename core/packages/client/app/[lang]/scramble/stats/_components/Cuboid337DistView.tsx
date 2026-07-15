'use client';

// 3×3×7(337)解步数分布 —— **离线预计算的采样直方图**(非全空间精确曲线):3×3×7 可达状态
// 126,859,598,081,556,480,000(≈1.27×10²⁰,Schreier-Sims 实算),太大无法整图枚举。分布由 build 脚本
// (scramble-stats-build/src/build_puzzle_sampled_dist.ts)**离线**采 N 条 cstimer 同款随机打乱、逐条用
// 两阶段约简求解器求解、把返回解步数分桶,落静态 stats/scramble/dist_337.json;本页**只 fetch + 渲染**,
// 进页不做任何求解(铁律:TIER C/D 分布严禁浏览器现场采样)。下载样本来自 JSON 内嵌的 generatedSamples。
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';

const C337_COLOR = '#0ea5e9';   // 数据天蓝(非 UI 灰阶)
// shape 变更或数据重算时 bump(防缓存旧 JSON)。
const V = '20260621';
// 可达状态数 / 轨道乘积:与 lib/cuboid337-solver 同源常量(测试已锁,纯字符串,不引求解器运行时)。
const STATE_COUNT_STR = '126,859,598,081,556,480,000';
const ORBIT_PRODUCT_STR = '2,283,472,765,468,016,640,000';

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

export default function Cuboid337DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [json, setJson] = useState<DistJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(statsUrl('/stats/scramble/dist_337.json') + `?v=${V}`)
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
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: '337', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '3×3×7(采样,近最优,非全空间)', en: '3×3×7 (sampled, near-optimal, not full-space)' }),
    fillColors: [C337_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['length,scramble,optimal'];
    for (const s of json?.generatedSamples ?? []) lines.push(`${s.length},${s.scramble},${s.optimal ? 1 : 0}`);
    downloadText('337_sample.csv', lines.join('\n'));
  };

  const stateCountStr = json?.stateCountStr ?? STATE_COUNT_STR;

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
              zh: '随机打乱样本(离线预计算,两阶段近最优,非全空间)',
              en: 'random-scramble samples (precomputed offline, two-phase near-optimal, not full-space)',
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
                  <ScramblePreview2D event="337" scramble={scr} size={26} />
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
            zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×7 有 ${stateCountStr} 个可达状态(轨道乘积 ${ORBIT_PRODUCT_STR} 因 18× 奇偶耦合而过计,实际由 Schreier-Sims 实算),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 主要是近最优、浅态为最优;页面只读取预计算结果,不在浏览器里求解。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。cstimer 的 “/ 333” 速记在 3×3×7 上无刚体实现,这里只解刚体打乱部分。`,
            en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×7 has ${stateCountStr} reachable states (the orbit product ${ORBIT_PRODUCT_STR} over-counts it by an 18× parity coupling; the true count is from Schreier-Sims), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — mostly near-optimal, optimal for shallow states; this page only reads the precomputed result and does no in-browser solving. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed. cstimer's "/ 333" shorthand has no rigid realisation on a 3×3×7, so only the rigid scramble part is solved.`,
          })}
        </span>
        <span>{tr({ zh: '生成时间', en: 'Generated' })}: {json.generated_at}</span>
      </div>
    </>
  );
}
