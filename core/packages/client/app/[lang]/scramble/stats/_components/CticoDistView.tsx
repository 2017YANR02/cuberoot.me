'use client';

// 二十面体魔方(Icosamate, ctico)解步数分布 —— **离线预计算的采样直方图**(非全空间精确曲线):ctico 可达状态
// ≈ 3.556×10³³(= 12!·5¹²·20!/80,Schreier-Sims 实算),太大无法整图枚举。分布由 build 脚本
// (scramble-stats-build/src/build_puzzle_sampled_dist.ts)**离线**采 N 条 cstimer 同款随机打乱、逐条用从零对易子
// 约简求解器求解、把返回解步数分桶,落静态 stats/scramble/dist_ctico.json;本页**只 fetch + 渲染**,进页不做任何
// 求解(铁律:TIER C/D 分布严禁浏览器现场采样)。下载样本来自 JSON 内嵌的 generatedSamples。
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';

const CTICO_COLOR = '#8b5cf6';    // 数据紫(非 UI 灰阶)
// shape 变更或数据重算时 bump(防缓存旧 JSON)。
const V = '20260622';

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

export default function CticoDistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [json, setJson] = useState<DistJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(statsUrl('/stats/scramble/dist_ctico.json') + `?v=${V}`)
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
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'ctico', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '二十面体(采样, 有界, 非全空间)', en: 'Icosamate (sampled, bounded, not full-space)' }),
    fillColors: [CTICO_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['length,scramble,optimal'];
    for (const s of json?.generatedSamples ?? []) lines.push(`${s.length},${s.scramble},${s.optimal ? 1 : 0}`);
    downloadText('ctico_sample.csv', lines.join('\n'));
  };

  const stateCountStr = json?.stateCountStr ?? '3,556,408,552,733,836,800,000,000,000,000,000';

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
              zh: `${sampleCount.toLocaleString()} 条随机打乱样本(离线预计算,从零对易子约简,有界,非全空间)`,
              en: `${sampleCount.toLocaleString()} random-scramble samples (precomputed offline, from-scratch commutator reduction, bounded, not full-space)`,
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
                  <ScramblePreview2D event="ctico" scramble={scr} size={26} />
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
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(随机态样本,有界约简)', en: 'Summary stats (random-state sample, bounded reduction)' })}</div>
          <div className="scramble-stats-stat-grid">
            <Cell label={tr({ zh: '样本均值', en: 'sample mean' })} value={stats.mean.toFixed(1)} />
            <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(stats.median)} />
            <Cell label={tr({ zh: '最小', en: 'min' })} value={String(stats.min)} />
            <Cell label={tr({ zh: '最大', en: 'max' })} value={String(stats.max)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:二十面体魔方有 ${stateCountStr} 个可达状态(= 12!·5¹²·20!/80,由 Schreier-Sims 实算),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 这是有界(非最优)的从零对易子约简,故步数偏长。页面只读取预计算结果,不在浏览器里求解。它是深切顶点转的二十面体:12 个角(Z5 取向,单一轨道)+ 20 个面心(1 个被所有转动固定);求解器先用 3-循环 + Z5 扭转归位角(角取向之和与步数耦合,用前缀调到 5 的倍数),再用保持角不变的面心 3-循环归位其余 19 个面心。它不是 WCA 项目,示例即采样到的真实随机打乱;cstimer 用 5 阶顶点转打乱(不 jumble),本求解器即覆盖该群。`,
            en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Icosamate has ${stateCountStr} reachable states (= 12!·5¹²·20!/80, from Schreier-Sims), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — this is a bounded (not optimal) from-scratch commutator reduction, so lengths run long. This page only reads the precomputed result and does no in-browser solving. It is a deep-cut vertex-turning icosahedron: 12 corners (Z5 orientation, a single orbit) + 20 face-centers (one fixed by every turn); the solver fixes the corners with 3-cycles + Z5 twists (the corner-orientation sum is coupled to the move count, neutralized with a prefix), then solves the other 19 face-centers with vertex-preserving face-center 3-cycles. It is not a WCA event; the examples are the actual sampled random scrambles; cstimer scrambles with order-5 vertex turns (no jumbling), which is exactly the group this solver covers.`,
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
